document.addEventListener('DOMContentLoaded', () => {
    // Firebase SDK 로드 최종 확인
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

    // === 어떤 상황에서도 댓글창을 반드시 생성하는 렌더링 함수 ===
    const renderGuaranteedTopicBoard = async () => {
        boardContainer.innerHTML = '<p>게시판을 준비하는 중입니다...</p>';
        try {
            let topicDocRef;
            const topicQuery = await db.collection('posts').where('category', '==', category).limit(1).get();

            if (topicQuery.empty) {
                console.log(`No topic for '${category}'. Creating a default topic.`);
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

            const topicId = topicDocRef.id;
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

            const commentsList = document.getElementById('comments-list');
            const commentForm = document.getElementById('comment-form');

            db.collection('posts').doc(topicId).collection('comments').orderBy('createdAt', 'asc')
                .onSnapshot(snapshot => {
                    commentsList.innerHTML = '';
                    if (snapshot.empty) {
                        commentsList.innerHTML = '<p class="no-comments">가장 먼저 당신의 의견을 남겨주세요!</p>';
                    } else {
                        snapshot.forEach(doc => {
                            const comment = doc.data();
                            const commentEl = document.createElement('div');
                            commentEl.className = 'comment-item';
                            commentEl.dataset.id = doc.id;
                            commentEl.innerHTML = `
                                <div class="comment-info">
                                    <strong>${comment.author}</strong>
                                    <span class="comment-meta">${new Date(comment.createdAt.seconds * 1000).toLocaleString()}</span>
                                </div>
                                <p class="comment-body">${comment.text.replace(/\n/g, '<br>')}</p>
                                <div class="comment-actions">
                                    <button class="edit-comment-btn">수정</button>
                                    <button class="delete-comment-btn">삭제</button>
                                </div>
                            `;
                            commentsList.appendChild(commentEl);
                        });
                    }
                });

            commentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const author = document.getElementById('comment-author').value.trim();
                const password = document.getElementById('comment-password').value.trim();
                const text = document.getElementById('comment-text').value.trim();

                if (!author || !password || !text) {
                    alert('닉네임, 비밀번호, 내용을 모두 입력해야 합니다.');
                    return;
                }
                try {
                    await db.collection('posts').doc(topicId).collection('comments').add({ author, password, text, createdAt: new Date() });
                    commentForm.reset();
                } catch (error) {
                    alert('오류: 댓글을 등록하지 못했습니다.');
                }
            });

            commentsList.addEventListener('click', async (e) => {
                const commentItem = e.target.closest('.comment-item');
                if (!commentItem) return;
                const commentId = commentItem.dataset.id;
                const commentRef = db.collection('posts').doc(topicId).collection('comments').doc(commentId);

                // --- 수정 버튼 ---
                if (e.target.classList.contains('edit-comment-btn')) {
                    const enteredPassword = prompt('댓글을 수정하려면 비밀번호를 입력하세요.');
                    if (!enteredPassword) return;

                    try {
                        const doc = await commentRef.get();
                        if (doc.exists && doc.data().password === enteredPassword) {
                            const commentBody = commentItem.querySelector('.comment-body');
                            const currentText = doc.data().text;
                            
                            commentItem.classList.add('editing');
                            commentBody.innerHTML = `<textarea class="edit-textarea">${currentText}</textarea>`;
                            
                            const actions = commentItem.querySelector('.comment-actions');
                            actions.innerHTML = `
                                <button class="save-comment-btn">저장</button>
                                <button class="cancel-edit-btn">취소</button>
                            `;

                        } else {
                            alert('비밀번호가 일치하지 않거나 댓글이 존재하지 않습니다.');
                        }
                    } catch (error) {
                        alert('오류: 댓글 정보를 가져오지 못했습니다.');
                    }
                }

                // --- 저장 버튼 ---
                if (e.target.classList.contains('save-comment-btn')) {
                    const newText = commentItem.querySelector('.edit-textarea').value.trim();
                    if (!newText) {
                        alert('내용을 입력해주세요.');
                        return;
                    }
                    try {
                        await commentRef.update({ text: newText });
                        // onSnapshot이 자동으로 화면을 갱신하므로 별도 처리 필요 없음
                    } catch (error) {
                        alert('오류: 댓글을 수정하지 못했습니다.');
                    }
                }

                // --- 수정 취소 버튼 ---
                if (e.target.classList.contains('cancel-edit-btn')) {
                    // onSnapshot 리스너가 있기 때문에, 특별히 아무것도 하지 않아도
                    // Firestore 데이터가 변경되지 않았으므로 다음번 자동 새로고침 때 원래대로 돌아오거나
                    // 수동으로 UI를 복원할 수 있습니다. 가장 간단한 방법은 UI를 직접 복원하는 것입니다.
                     const doc = await commentRef.get();
                     if(doc.exists) {
                         const commentBody = commentItem.querySelector('.comment-body');
                         commentBody.innerHTML = `<p class="comment-body">${doc.data().text.replace(/\n/g, '<br>')}</p>`;
                         const actions = commentItem.querySelector('.comment-actions');
                         actions.innerHTML = `
                            <button class="edit-comment-btn">수정</button>
                            <button class="delete-comment-btn">삭제</button>
                         `;
                         commentItem.classList.remove('editing');
                     }
                }

                // --- 삭제 버튼 ---
                if (e.target.classList.contains('delete-comment-btn')) {
                    const enteredPassword = prompt('댓글을 삭제하려면 비밀번호를 입력하세요.');
                    if (!enteredPassword) return;

                    try {
                        const doc = await commentRef.get();
                        if (doc.exists && doc.data().password === enteredPassword) {
                            await commentRef.delete();
                        } else {
                            alert('비밀번호가 일치하지 않거나 댓글이 존재하지 않습니다.');
                        }
                    } catch (error) {
                        alert('오류: 댓글을 삭제하지 못했습니다.');
                    }
                }
            });

        } catch (error) {
            console.error("게시판 렌더링 최종 오류:", error);
            boardContainer.innerHTML = '<p style="color:red; text-align:center; font-weight:bold;">죄송합니다. 게시판을 표시하는 데 실패했습니다. 페이지를 새로고침해주세요.</p>';
        }
    };

    renderGuaranteedTopicBoard();
});
