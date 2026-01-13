
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase가 초기화되지 않았습니다.');
        return;
    }

    const db = firebase.firestore();
    const mainContainer = document.querySelector('main.container');
    const category = document.body.dataset.category;
    const ADMIN_PASSWORD = "0216";

    const SUB_CATEGORIES = ['십이운성', '신살', '격국', '기타'];
    let currentSubCategory = '전체';
    
    let allPosts = [];
    let currentPage = 1;
    const postsPerPage = 15;

    const renderPageLayout = async () => {
        const boardIntro = "이곳은 사주 명리에 대한 깊이 있는 지식과 정보를 나누는 공간입니다. 십이운성, 신살, 격국 등 전문적인 개념부터 실전 통변에 유용한 팁까지, The Fortune의 운영자가 직접 작성한 글들을 만나보실 수 있습니다.";
        mainContainer.innerHTML = `
            <section class="content-section">
                <div class="section-header">
                    <h2>사주 정보</h2>
                    <p>${boardIntro}</p>
                </div>
                <div class="category-filters">
                    <button class="filter-btn active" data-filter="전체">전체</button>
                    ${SUB_CATEGORIES.map(sub => `<button class="filter-btn" data-filter="${sub}">${sub}</button>`).join('')}
                </div>
                <div class="posts-list" id="posts-list-container"><p>게시글을 불러오는 중...</p></div>
                <div class="pagination-controls" id="pagination-controls-container"></div>
                <div class="board-footer">
                    <button id="write-btn">글쓰기</button>
                </div>
            </section>
        `;
        attachEventListeners();
        await fetchAndRenderPosts();
    };

    const fetchAndRenderPosts = async () => {
        const listContainer = document.getElementById('posts-list-container');
        const paginationContainer = document.getElementById('pagination-controls-container');
        listContainer.innerHTML = '<p>게시글을 불러오는 중...</p>';
        paginationContainer.innerHTML = ''; 

        try {
            let query = db.collection('posts').where('category', '==', category);
            if (currentSubCategory !== '전체') {
                query = query.where('subCategory', '==', currentSubCategory);
            }
            
            const snapshot = await query.get();
            
            allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 클라이언트 사이드에서 정렬을 수행합니다.
            allPosts.sort((a, b) => {
                const dateA = a.createdAt?.toDate() || new Date(0);
                const dateB = b.createdAt?.toDate() || new Date(0);
                return dateB - dateA; // 최신순으로 정렬
            });
            
            currentPage = 1; 

            if (snapshot.empty) {
                const message = currentSubCategory === '전체' ? "아직 새로운 글이 없습니다." : `'${currentSubCategory}' 카테고리에 아직 새로운 글이 없습니다.`;
                listContainer.innerHTML = `<p>${message}</p>`;
            } else {
                renderPostsForCurrentPage();
                renderPaginationControls();
            }
        } catch (error) {
            console.error("게시글 목록 로딩 오류: ", error);
            listContainer.innerHTML = '<p style="color: red;">오류: 게시글을 불러오는 데 실패했습니다. 다시 시도해 주세요.</p>';
        }
    };

    const renderPostsForCurrentPage = () => {
        const listContainer = document.getElementById('posts-list-container');
        const startIndex = (currentPage - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;
        const postsToRender = allPosts.slice(startIndex, endIndex);

        let postsHtml = postsToRender.map(post => {
            return `
                <div class="post-item" data-id="${post.id}">
                    <h3>${post.title}</h3>
                </div>
            `;
        }).join('');
        listContainer.innerHTML = postsHtml;

        // 각 포스트 아이템에 클릭 이벤트 추가
        document.querySelectorAll('.post-item').forEach(item => {
            item.addEventListener('click', () => {
                const postId = item.dataset.id;
                window.location.href = `post-detail.html?id=${postId}`;
            });
        });
    };

    const renderPaginationControls = () => {
        const paginationContainer = document.getElementById('pagination-controls-container');
        const totalPages = Math.ceil(allPosts.length / postsPerPage);
        paginationContainer.innerHTML = '';

        if (totalPages <= 1) return;

        let paginationHtml = '';
        paginationHtml += `<button data-page="1" ${currentPage === 1 ? 'disabled' : ''}>&lt;&lt;</button>`;
        paginationHtml += `<button data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;
        paginationHtml += `<span class="page-info">${currentPage} / ${totalPages}</span>`;
        paginationHtml += `<button data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
        paginationHtml += `<button data-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''}>&gt;&gt;</button>`;
        
        paginationContainer.innerHTML = paginationHtml;

        paginationContainer.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                currentPage = parseInt(button.dataset.page);
                renderPostsForCurrentPage();
                renderPaginationControls();
            });
        });
    };

    const attachEventListeners = () => {
        document.getElementById('write-btn').addEventListener('click', () => showPasswordModal(null, 'write'));
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentSubCategory = e.target.dataset.filter;
                document.querySelector('.filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                fetchAndRenderPosts();
            });
        });
    };

    const showPasswordModal = (postId, action) => {
        const modalId = 'password-modal-overlay';
        const existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();
        
        let title = '관리자 인증';
        if(action === 'write') title = '새 글 작성';

        const modalHtml = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal-content password-modal">
                    <span class="close-btn">&times;</span>
                    <h2>${title}</h2>
                    <p>계속하려면 비밀번호를 입력하세요.</p>
                    <input type="password" id="admin-password-input" placeholder="비밀번호">
                    <button id="admin-confirm-btn">확인</button>
                    <p class="error-message" style="display:none;">비밀번호가 올바르지 않습니다.</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalOverlay = document.getElementById(modalId);
        modalOverlay.style.display = 'flex';
        const passwordInput = document.getElementById('admin-password-input');
        passwordInput.focus();

        const handleConfirm = async () => {
            if (passwordInput.value === ADMIN_PASSWORD) {
                modalOverlay.remove();
                if (action === 'write') {
                    showWriteModal();
                } 
            } else {
                modalOverlay.querySelector('.error-message').style.display = 'block';
            }
        };

        modalOverlay.querySelector('#admin-confirm-btn').addEventListener('click', handleConfirm);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleConfirm();
        });
        modalOverlay.querySelector('.close-btn').addEventListener('click', () => modalOverlay.remove());
    };

    const showWriteModal = (post = null) => {
        const modalId = 'write-modal-overlay';
        const existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();
        const isEditing = post !== null;
        const subCategoryOptions = SUB_CATEGORIES.map(sub => `<option value="${sub}" ${isEditing && post.subCategory === sub ? 'selected' : ''}>${sub}</option>`).join('');
        const modalHtml = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal-content write-modal">
                    <span class="close-btn">&times;</span>
                    <h2>${isEditing ? '글 수정' : '새 글 작성'}</h2>
                    <select id="post-sub-category">${subCategoryOptions}</select>
                    <input type="text" id="post-title" placeholder="제목" value="${isEditing ? post.title : ''}" required>
                    <textarea id="post-content" placeholder="내용">${isEditing ? post.content : ''}</textarea>
                    <button id="save-post-btn">${isEditing ? '수정 완료' : '저장'}</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalOverlay = document.getElementById(modalId);
        modalOverlay.style.display = 'flex';
        modalOverlay.querySelector('.close-btn').addEventListener('click', () => modalOverlay.remove());
        modalOverlay.querySelector('#save-post-btn').addEventListener('click', async () => {
            const subCategory = document.getElementById('post-sub-category').value;
            const title = document.getElementById('post-title').value;
            const content = document.getElementById('post-content').value;
            if (!title.trim() || !content.trim()) {
                alert('제목과 내용을 모두 입력해주세요.');
                return;
            }
            try {
                if (isEditing) {
                    await db.collection('posts').doc(post.id).update({
                        title, content, subCategory,
                    });
                } else {
                    await db.collection('posts').add({
                        title, content, category, subCategory,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                modalOverlay.remove();
                await fetchAndRenderPosts();
            } catch (error) {
                console.error("글 저장/수정 오류: ", error);
                alert("작업을 완료하는 데 실패했습니다.");
            }
        });
    };

    await renderPageLayout();
});
