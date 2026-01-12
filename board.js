document.addEventListener('DOMContentLoaded', () => {
    // Firebase 앱 초기화 확인
    const checkFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            clearInterval(checkFirebase);
            initializeBoard();
        }
    }, 100);

    function initializeBoard() {
        const db = firebase.firestore();
        const category = document.body.dataset.category;
        const isAdmin = document.body.dataset.isAdmin === 'true';
        const postsList = document.querySelector('.posts-list');
        const boardFooter = document.querySelector('.board-footer');

        if (!postsList) return;
        
        // 관리자가 아닐 경우, 글쓰기 버튼 숨기기
        if (!isAdmin && boardFooter) {
            boardFooter.style.display = 'none';
        }

        // 실시간으로 게시글 목록 가져오기
        db.collection('posts')
            .where('category', '==', category)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                if (snapshot.empty) {
                    postsList.innerHTML = '<p>아직 게시글이 없습니다.</p>';
                    return;
                }

                let html = '';
                snapshot.forEach(doc => {
                    const post = doc.data();
                    const postId = doc.id;
                    // 관리자일 경우에만 수정/삭제 버튼을 추가
                    const adminButtons = isAdmin ? `
                        <div class="post-actions">
                            <button class="edit-post-btn" data-id="${postId}">수정</button>
                            <button class="delete-post-btn danger" data-id="${postId}">삭제</button>
                        </div>
                    ` : '';

                    html += `
                        <div class="post" id="${postId}">
                            <h3>${post.title}</h3>
                            <p>${post.content}</p>
                            ${adminButtons}
                        </div>
                    `;
                });
                postsList.innerHTML = html;

                // 관리자일 경우에만 이벤트 리스너 설정
                if (isAdmin) {
                    setupAdminEventListeners();
                }
            }, err => {
                console.error("Error fetching posts: ", err);
                postsList.innerHTML = '<p>게시글을 불러오는 데 실패했습니다.</p>';
            });

        // 관리자 기능 관련 UI 및 이벤트 리스너
        if (isAdmin) {
            const postModal = document.getElementById('post-modal');
            const editModal = document.getElementById('edit-modal');
            const closeButtons = document.querySelectorAll('.close-btn');
            const writePostBtn = document.querySelector('.write-post-btn');

            // 새 글쓰기 모달 열기
            if (writePostBtn) {
                writePostBtn.onclick = () => postModal.style.display = 'block';
            }

            // 모달 닫기
            closeButtons.forEach(btn => {
                btn.onclick = () => {
                    postModal.style.display = 'none';
                    editModal.style.display = 'none';
                };
            });
            window.onclick = (event) => {
                if (event.target == postModal || event.target == editModal) {
                    postModal.style.display = 'none';
                    editModal.style.display = 'none';
                }
            };
            
            // 새 글 제출
            const postForm = document.getElementById('post-form');
            if(postForm) {
                postForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const title = document.getElementById('title').value;
                    const content = document.getElementById('content').value;

                    db.collection('posts').add({
                        title: title,
                        content: content,
                        category: category,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).then(() => {
                        postForm.reset();
                        postModal.style.display = 'none';
                    }).catch(error => console.error("Error adding document: ", error));
                });
            }

            // 글 수정 폼 제출
            const editForm = document.getElementById('edit-form');
             if(editForm) {
                editForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const id = document.getElementById('edit-post-id').value;
                    const title = document.getElementById('edit-title').value;
                    const content = document.getElementById('edit-content').value;

                    db.collection('posts').doc(id).update({
                        title: title,
                        content: content
                    }).then(() => {
                        editForm.reset();
                        editModal.style.display = 'none';
                    }).catch(error => console.error("Error updating document: ", error));
                });
            }
        }
    }
    
    function setupAdminEventListeners() {
        const postsList = document.querySelector('.posts-list');
        if(!postsList) return;

        postsList.addEventListener('click', (e) => {
            const db = firebase.firestore();
            const target = e.target;
            const id = target.dataset.id;

            // 삭제 버튼
            if (target.classList.contains('delete-post-btn')) {
                if (confirm('정말 이 글을 삭제하시겠습니까?')) {
                    db.collection('posts').doc(id).delete().catch(error => console.error("Error removing document: ", error));
                }
            }
            
            // 수정 버튼
            if (target.classList.contains('edit-post-btn')) {
                const editModal = document.getElementById('edit-modal');
                const postElement = document.getElementById(id);
                if (!postElement) return;

                const title = postElement.querySelector('h3').textContent;
                const content = postElement.querySelector('p').textContent;

                document.getElementById('edit-post-id').value = id;
                document.getElementById('edit-title').value = title;
                document.getElementById('edit-content').value = content;
                editModal.style.display = 'block';
            }
        });
    }
});