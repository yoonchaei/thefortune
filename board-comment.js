document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
        console.error('CRITICAL: Firebase SDK가 로드되지 않았습니다.');
        const boardContainer = document.getElementById('board-container');
        if (boardContainer) boardContainer.innerHTML = '<p style="color:red; text-align:center; font-weight:bold;">오류: 댓글 기능을 표시할 수 없습니다. Firebase 연동 설정을 확인하세요.</p>';
        return;
    }

    const db = firebase.firestore();
    const boardContainer = document.getElementById('board-container');
    const category = document.body.dataset.category;

    if (!boardContainer || !category) {
        console.error('CRITICAL: 게시판 초기화에 필요한 HTML 요소를 찾을 수 없습니다.');
        return;
    }

    let currentTopicId = null;

    const renderComments = (comments) => {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;

        commentsList.innerHTML = '';
        if (comments.length === 0) {
            commentsList.innerHTML = '<p class="no-comments">가장 먼저 당신의 의견을 남겨주세요!</p>';
            return;
        }

        const commentsById = new Map(comments.map(c => [c.id, { ...c.data(), id: c.id, children: [] }]));
        const rootComments = [];

        for (const comment of commentsById.values()) {
            if (comment.parentId) {
                commentsById.get(comment.parentId)?.children.push(comment);
            } else {
                rootComments.push(comment);
            }
        }

        const createCommentEl = (comment) => {
            const el = document.createElement('div');
            el.className = 'comment-item';
            el.dataset.id = comment.id;
            el.innerHTML = `
                <div class="comment-content">
                    <div class="comment-info">
                        <strong>${comment.author}</strong>
                        <span class="comment-meta">${new Date(comment.createdAt.seconds * 1000).toLocaleString()}</span>
                    </div>
                    <p class="comment-body">${comment.text.replace(/\n/g, '<br>')}</p>
                    <div class="comment-actions">
                        <button class="reply-comment-btn">답글</button>
                        <button class="edit-comment-btn">수정</button>
                        <button class="delete-comment-btn">삭제</button>
                    </div>
                </div>
                <div class="replies-container"></div>
            `;
            return el;
        };

        const appendComments = (container, commentsToAppend) => {
            for (const comment of commentsToAppend) {
                const commentEl = createCommentEl(comment);
                container.appendChild(commentEl);
                if (comment.children.length > 0) {
                    const repliesContainer = commentEl.querySelector('.replies-container');
                    appendComments(repliesContainer, comment.children);
                }
            }
        };

        appendComments(commentsList, rootComments);
    };

    const renderTopicBoard = async () => {
        boardContainer.innerHTML = '<p>게시판을 준비하는 중입니다...</p>';
        try {
            let topicDocRef;
            const topicQuery = await db.collection('posts').where('category', '==', category).limit(1).get();

            if (topicQuery.empty) {
                const defaultTopicData = {
                    title: category === 'free' ? '자유로운 이야기' : '무엇이든 물어보세요',
                    content: category === 'free' ? '이곳에서 사주에 대한 재미있는 생각이나 경험을 자유롭게 나눠주세요.' : '사주 명리학에 대해 궁금한 점을 질문하고 답변을 받아보세요.',
                    category: category,
                    createdAt: new Date()
                };
                topicDocRef = await db.collection('posts').add(defaultTopicData);
            } else {
                topicDocRef = topicQuery.docs[0].ref;
            }

            currentTopicId = topicDocRef.id;
            const topicDoc = await topicDocRef.get();
            const topicData = topicDoc.data();

            boardContainer.innerHTML = `
                <div class="topic-header">
                    <h3>${topicData.title}</h3>
                    <p>${topicData.content.replace(/\n/g, '<br>')}</p>
                </div>
                <div class="comments-section">
                    <div id="comments-list"></div>
                    <form id="comment-form">
                        <h4>댓글 남기기</h4>
                        <div class="comment-input-group">
                            <input type="text" id="comment-author" placeholder="닉네임" required>
                            <input type="password" id="comment-password" placeholder="비밀번호 (수정/삭제 시 필요)" required>
                        </div>
                        <textarea id="comment-text" placeholder="주제에 대한 당신의 생각을 자유롭게 나눠주세요." required></textarea>
                        <button type="submit">댓글 등록</button>
                    </form>
                </div>
            `;

            db.collection('posts').doc(currentTopicId).collection('comments').orderBy('createdAt', 'asc')
                .onSnapshot(snapshot => {
                    renderComments(snapshot.docs);
                });

        } catch (error) {
            console.error("게시판 렌더링 오류:", error);
            boardContainer.innerHTML = '<p style="color:red; text-align:center; font-weight:bold;">죄송합니다. 게시판을 표시하는 데 실패했습니다.</p>';
        }
    };

    boardContainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;

        if (form.id === 'comment-form' || form.classList.contains('reply-form')) {
            const authorInput = form.querySelector('input[type="text"]');
            const passwordInput = form.querySelector('input[type="password"]');
            const textInput = form.querySelector('textarea');

            const author = authorInput.value.trim();
            const password = passwordInput.value.trim();
            const text = textInput.value.trim();

            if (!author || !password || !text) {
                alert('닉네임, 비밀번호, 내용을 모두 입력해야 합니다.');
                return;
            }

            const commentData = { author, password, text, createdAt: new Date() };
            const parentId = form.dataset.parentId;
            if (parentId) {
                commentData.parentId = parentId;
            }

            try {
                await db.collection('posts').doc(currentTopicId).collection('comments').add(commentData);
                form.reset();
                if (parentId) form.remove();
            } catch (error) {
                alert('오류: 댓글을 등록하지 못했습니다.');
            }
        }
    });

    boardContainer.addEventListener('click', async (e) => {
        const commentItem = e.target.closest('.comment-item');
        if (!commentItem) return;
        
        const commentId = commentItem.dataset.id;
        const commentRef = db.collection('posts').doc(currentTopicId).collection('comments').doc(commentId);

        // 답글 버튼
        if (e.target.classList.contains('reply-comment-btn')) {
            const existingReplyForm = commentItem.querySelector('.reply-form');
            if (existingReplyForm) {
                existingReplyForm.remove();
                return;
            }
            
            const replyForm = document.createElement('form');
            replyForm.className = 'reply-form';
            replyForm.dataset.parentId = commentId;
            replyForm.innerHTML = `
                <h4>대댓글 남기기</h4>
                <div class="comment-input-group">
                    <input type="text" placeholder="닉네임" required>
                    <input type="password" placeholder="비밀번호" required>
                </div>
                <textarea placeholder="대댓글을 입력하세요." required></textarea>
                <div class="reply-form-actions">
                    <button type="submit">등록</button>
                    <button type="button" class="cancel-reply-btn">취소</button>
                </div>
            `;
            commentItem.appendChild(replyForm);
        }

        // 답글 취소 버튼
        if (e.target.classList.contains('cancel-reply-btn')) {
            e.target.closest('.reply-form').remove();
        }

        // 수정 버튼
        if (e.target.classList.contains('edit-comment-btn')) {
             const enteredPassword = prompt('댓글을 수정하려면 비밀번호를 입력하세요.');
            if (!enteredPassword) return;

            try {
                const doc = await commentRef.get();
                if (doc.exists && doc.data().password === enteredPassword) {
                    const commentContent = commentItem.querySelector('.comment-content');
                    const currentText = doc.data().text;
                    commentContent.style.display = 'none';
                    
                    const editForm = document.createElement('div');
                    editForm.className = 'edit-form';
                    editForm.innerHTML = `
                        <textarea class="edit-textarea">${currentText}</textarea>
                        <div class="edit-form-actions">
                            <button class="save-comment-btn">저장</button>
                            <button class="cancel-edit-btn">취소</button>
                        </div>
                    `;
                    commentItem.insertBefore(editForm, commentContent.nextSibling);
                } else {
                    alert('비밀번호가 일치하지 않거나 댓글이 존재하지 않습니다.');
                }
            } catch (error) {
                alert('오류: 댓글 정보를 가져오지 못했습니다.');
            }
        }

        // 저장 버튼
        if (e.target.classList.contains('save-comment-btn')) {
            const newText = commentItem.querySelector('.edit-textarea').value.trim();
            if (!newText) {
                alert('내용을 입력해주세요.');
                return;
            }
            try {
                await commentRef.update({ text: newText });
                // onSnapshot이 자동으로 화면을 갱신
            } catch (error) {
                alert('오류: 댓글을 수정하지 못했습니다.');
            }
        }

        // 수정 취소 버튼
        if (e.target.classList.contains('cancel-edit-btn')) {
            const editForm = commentItem.querySelector('.edit-form');
            if(editForm) editForm.remove();
            const commentContent = commentItem.querySelector('.comment-content');
            if(commentContent) commentContent.style.display = 'block';
        }

        // 삭제 버튼
        if (e.target.classList.contains('delete-comment-btn')) {
            const enteredPassword = prompt('댓글을 삭제하려면 비밀번호를 입력하세요. (대댓글도 함께 삭제됩니다)');
            if (!enteredPassword) return;

            try {
                const doc = await commentRef.get();
                if (doc.exists && doc.data().password === enteredPassword) {
                    // 대댓글(자식)부터 삭제
                    const batch = db.batch();
                    const snapshot = await db.collection('posts').doc(currentTopicId).collection('comments').where('parentId', '==', commentId).get();
                    snapshot.docs.forEach(childDoc => {
                         batch.delete(childDoc.ref);
                    });
                    // 부모 댓글 삭제
                    batch.delete(commentRef);
                    await batch.commit();

                } else {
                    alert('비밀번호가 일치하지 않거나 댓글이 존재하지 않습니다.');
                }
            } catch (error) {
                console.error("댓글 삭제 오류:", error);
                alert('오류: 댓글을 삭제하지 못했습니다.');
            }
        }
    });

    renderTopicBoard();
});
