
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase가 초기화되지 않았습니다.');
        return;
    }

    const db = firebase.firestore();
    const mainContent = document.querySelector('main.container');
    const category = document.body.dataset.category;
    let currentPostId = null;
    let unsubscribeComments = null;

    const ADMIN_PASSWORD = '0216';

    // --- 뷰 렌더링 함수 ---
    const renderListView = () => {
        currentPostId = null;
        if (unsubscribeComments) unsubscribeComments();

        mainContent.innerHTML = `
            <section class="content-section">
                <div class="section-header">
                    <h2>사주 정보</h2>
                    <p>전문가가 직접 작성하고 관리하는 깊이 있는 사주 지식 정보입니다.</p>
                </div>
                <div class="posts-list"><p>게시글을 불러오는 중입니다...</p></div>
                <div class="board-footer">
                    <button id="write-btn">새 글 작성하기</button>
                </div>
            </section>
            <div id="password-modal" class="modal-overlay">
                <div class="modal-content">
                    <h2>관리자 인증</h2>
                    <p>글을 작성하려면 비밀번호를 입력하세요.</p>
                    <input type="password" id="password-input" placeholder="비밀번호">
                    <p id="password-error" class="error-message"></p>
                    <button id="password-submit">확인</button>
                </div>
            </div>
            <div id="write-modal" class="modal-overlay">
                <div class="modal-content">
                     <span class="close-btn">&times;</span>
                    <h2>새 정보 글 작성</h2>
                    <form id="post-form">
                        <input type="text" id="post-title" placeholder="제목" required>
                        <textarea id="post-content" placeholder="내용" rows="10" required></textarea>
                        <button type="submit">게시하기</button>
                    </form>
                </div>
            </div>
        `;
        fetchAndDisplayPosts();
        setupEventListeners();
    };

    const renderDetailView = async (postId) => {
        currentPostId = postId;
        try {
            const doc = await db.collection('posts').doc(postId).get();
            if (!doc.exists) throw new Error('게시글 없음');
            
            const post = doc.data();
            const postDate = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleString() : '';
            
            mainContent.innerHTML = `
                <section class="post-detail-section">
                    <button id="back-to-list">목록으로 돌아가기</button>
                    <article class="post-full-content">
                        <h2>${post.title}</h2>
                        <p class="post-meta">게시일: ${postDate}</p>
                        <div class="content-body">${post.content.replace(/\n/g, '<br>')}</div>
                    </article>
                    <div class="comments-section">
                        <h3>댓글</h3>
                        <form id="comment-form">
                            <textarea id="comment-text" placeholder="따뜻한 응원과 격려의 댓글을 남겨주세요." rows="3" required></textarea>
                            <button type="submit">댓글 등록</button>
                        </form>
                        <div id="comments-list"></div>
                    </div>
                </section>
            `;

            document.getElementById('back-to-list').addEventListener('click', renderListView);
            document.getElementById('comment-form').addEventListener('submit', (e) => handleCommentSubmit(e, postId));
            listenForComments(postId);

        } catch (error) {
            console.error("상세 정보 로딩 실패: ", error);
            alert('게시글을 불러오는 데 실패했습니다.');
            renderListView();
        }
    };
    
    // --- 데이터 처리 및 UI 생성 함수 ---
    const fetchAndDisplayPosts = () => {
        const postsList = mainContent.querySelector('.posts-list');
        db.collection('posts').where('category', '==', category).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                postsList.innerHTML = '<p>아직 등록된 정보가 없습니다.</p>';
                return;
            }
            postsList.innerHTML = snapshot.docs.map(doc => {
                const post = doc.data();
                const preview = post.content.substring(0, 150);
                return `
                    <article class="post-item" data-id="${doc.id}">
                        <h3>${post.title}</h3>
                        <p>${preview}...</p>
                        <span class="post-meta">${post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : ''}</span>
                    </article>
                `;
            }).join('');
            mainContent.querySelectorAll('.post-item').forEach(item => {
                item.addEventListener('click', () => renderDetailView(item.dataset.id));
            });
        }, err => {
            console.error("게시글 로딩 오류: ", err);
            postsList.innerHTML = '<p>글을 불러오는 데 실패했습니다.</p>';
        });
    };

    const listenForComments = (postId) => {
        const commentsList = document.getElementById('comments-list');
        if (unsubscribeComments) unsubscribeComments();
        
        unsubscribeComments = db.collection('posts').doc(postId).collection('comments').orderBy('createdAt', 'asc').onSnapshot(snapshot => {
            const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const nestedComments = [];
            const commentMap = comments.reduce((map, comment) => (map[comment.id] = comment, comment.replies = [], map), {});

            comments.forEach(comment => {
                if (comment.parentId && commentMap[comment.parentId]) {
                    commentMap[comment.parentId].replies.push(comment);
                } else {
                    nestedComments.push(comment);
                }
            });

            commentsList.innerHTML = nestedComments.length ? '' : '<p>아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>';
            nestedComments.forEach(comment => renderComment(comment, postId, commentsList));
        });
    };
    
    const renderComment = (comment, postId, container, isReply = false) => {
        const div = document.createElement('div');
        div.className = `comment-item ${isReply ? 'reply' : ''}`;
        div.id = `comment-${comment.id}`;
        div.innerHTML = `
            <p><strong>익명</strong> <span class="comment-meta">- ${comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleString() : ''}</span></p>
            <p class="comment-text">${comment.text.replace(/\n/g, '<br>')}</p>
            <div class="comment-actions"><button class="reply-btn">대댓글</button></div>
            <div class="reply-form-container" style="display:none;"></div>
        `;
        container.appendChild(div);

        if (comment.replies && comment.replies.length > 0) {
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies-container';
            div.appendChild(repliesContainer);
            comment.replies.forEach(reply => renderComment(reply, postId, repliesContainer, true));
        }

        div.querySelector('.reply-btn').addEventListener('click', (e) => showReplyForm(e, comment.id, postId));
    };

    // --- 이벤트 핸들러 및 리스너 설정 ---
    const setupEventListeners = () => {
        const writeBtn = document.getElementById('write-btn');
        const passwordModal = document.getElementById('password-modal');
        const writeModal = document.getElementById('write-modal');

        if (writeBtn) writeBtn.addEventListener('click', () => passwordModal.style.display = 'flex');
        document.getElementById('password-submit').addEventListener('click', () => {
            if (document.getElementById('password-input').value === ADMIN_PASSWORD) {
                passwordModal.style.display = 'none';
                writeModal.style.display = 'flex';
            } else {
                document.getElementById('password-error').textContent = '비밀번호가 틀렸습니다.';
            }
        });
        writeModal.querySelector('.close-btn').addEventListener('click', () => writeModal.style.display = 'none');
        document.getElementById('post-form').addEventListener('submit', handlePostSubmit);
    };
    
    const handlePostSubmit = (e) => {
        e.preventDefault();
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        if (!title || !content) return;
        
        db.collection('posts').add({ title, content, category, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
            .then(() => { document.getElementById('write-modal').style.display = 'none'; e.target.reset(); })
            .catch(err => console.error("글 작성 오류: ", err));
    };

    const handleCommentSubmit = (e, postId, parentId = null) => {
        e.preventDefault();
        const form = e.target;
        const text = form.querySelector('textarea').value.trim();
        if (!text) return;

        const newComment = { text, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (parentId) newComment.parentId = parentId;

        db.collection('posts').doc(postId).collection('comments').add(newComment)
            .then(() => {
                form.reset();
                if (parentId) form.parentElement.style.display = 'none';
            })
            .catch(err => console.error("댓글 등록 오류: ", err));
    };

    const showReplyForm = (e, parentId, postId) => {
        const container = e.target.closest('.comment-item').querySelector('.reply-form-container');
        if (container.style.display === 'block') {
            container.style.display = 'none';
            return;
        }
        container.innerHTML = `
            <form class="reply-form">
                <textarea placeholder="대댓글을 작성하세요..." rows="2" required></textarea>
                <button type="submit">대댓글 등록</button>
            </form>
        `;
        container.style.display = 'block';
        container.querySelector('form').addEventListener('submit', (event) => handleCommentSubmit(event, postId, parentId));
        container.querySelector('textarea').focus();
    };

    // --- 초기화 ---
    renderListView();
});
