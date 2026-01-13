
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase가 초기화되지 않았습니다.');
        return;
    }

    const db = firebase.firestore();
    const contentArea = document.getElementById('post-content-area');
    const ADMIN_PASSWORD = "0216";
    let currentPost = null;

    const getPostIdFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    };

    const postId = getPostIdFromUrl();
    if (!postId) {
        contentArea.innerHTML = '<p style="color:red;">오류: 게시물 ID를 찾을 수 없습니다.</p>';
        return;
    }

    const fetchAndRenderPost = async () => {
        try {
            const docRef = db.collection('posts').doc(postId);
            const doc = await docRef.get();

            if (doc.exists) {
                currentPost = { id: doc.id, ...doc.data() };
                const post = currentPost;
                const createdAt = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : '날짜 정보 없음';
                
                contentArea.innerHTML = `
                    <div class="post-header">
                        <span class="post-subcategory">${post.subCategory || '기타'}</span>
                        <h1>${post.title}</h1>
                        <p class="post-meta">작성일: ${createdAt}</p>
                    </div>
                    <div class="post-content">
                        ${post.content.replace(/\n/g, '<br>')}
                    </div>
                `;
            } else {
                contentArea.innerHTML = '<p style="color:red;">해당 게시물을 찾을 수 없습니다.</p>';
            }
        } catch (error) {
            console.error("게시물 로딩 중 오류 발생: ", error);
            contentArea.innerHTML = '<p style="color:red;">게시물을 불러오는 중 오류가 발생했습니다.</p>';
        }
    };

    const attachEventListeners = () => {
        document.getElementById('back-to-list-btn').addEventListener('click', () => {
            window.location.href = 'information.html';
        });

        document.getElementById('edit-post-btn').addEventListener('click', () => {
            showPasswordModal('edit');
        });

        document.getElementById('delete-post-btn').addEventListener('click', () => {
            showPasswordModal('delete');
        });
    };

    const showPasswordModal = (action) => {
        const modalId = 'password-modal-overlay';
        const existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();

        const title = action === 'edit' ? '글 수정 인증' : '글 삭제 인증';
        const modalHtml = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal-content password-modal">
                    <span class="close-btn">&times;</span>
                    <h2>${title}</h2>
                    <p>계속하려면 관리자 비밀번호를 입력하세요.</p>
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
                if (action === 'edit') {
                    showWriteModal(currentPost);
                } else if (action === 'delete') {
                    if (confirm('정말로 이 글을 삭제하시겠습니까? 되돌릴 수 없습니다.')) {
                        try {
                            await db.collection('posts').doc(postId).delete();
                            alert('게시글이 삭제되었습니다.');
                            // [FIX] 페이지 이동 시 캐시를 무효화하여 목록을 항상 새로 그리도록 수정
                            window.location.href = `information.html?_t=${new Date().getTime()}`;
                        } catch (error) {
                            console.error("글 삭제 오류: ", error);
                            alert("글을 삭제하는 데 실패했습니다.");
                        }
                    }
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

    const showWriteModal = (post) => {
        const modalId = 'write-modal-overlay';
        const existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();
        
        const SUB_CATEGORIES = ['십이운성', '신살', '격국', '기타'];
        const subCategoryOptions = SUB_CATEGORIES.map(sub => `<option value="${sub}" ${post.subCategory === sub ? 'selected' : ''}>${sub}</option>`).join('');
        const modalHtml = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal-content write-modal">
                    <span class="close-btn">&times;</span>
                    <h2>글 수정</h2>
                    <select id="post-sub-category">${subCategoryOptions}</select>
                    <input type="text" id="post-title" placeholder="제목" value="${post.title}" required>
                    <textarea id="post-content" placeholder="내용">${post.content}</textarea>
                    <button id="save-post-btn">수정 완료</button>
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
                await db.collection('posts').doc(post.id).update({
                    title, content, subCategory
                });
                modalOverlay.remove();
                // [FIX] 수정 후 상세 페이지를 새로고침하여 최신 내용 확인
                alert("글이 성공적으로 수정되었습니다.");
                location.reload(true);
            } catch (error) {
                console.error("글 수정 오류: ", error);
                alert("글을 수정하는 데 실패했습니다.");
            }
        });
    };

    await fetchAndRenderPost();
    attachEventListeners();
});
