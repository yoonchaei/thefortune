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

            // 1. [핵심] 주제 글이 있는지 확인합니다.
            if (topicQuery.empty) {
                // 2. [핵심] 주제 글이 없다면, 자동으로 기본 주제를 생성합니다.
                console.log(`No topic for '${category}'. Creating a default topic.`);
                const defaultTopicData = {
                    title: category === 'free' ? '자유로운 이야기' : '무엇이든 물어보세요',
                    content: category === 'free' ? '이곳에서 사주에 대한 재미있는 생각이나 경험을 자유롭게 나눠주세요.' : '사주 명리학에 대해 궁금한 점을 질문하고 답변을 받아보세요.',
                    category: category,
                    createdAt: new Date()
                };
                topicDocRef = await db.collection('posts').add(defaultTopicData);
            } else {
                // 주제 글이 있다면 해당 글의 참조를 사용합니다.
                topicDocRef = topicQuery.docs[0].ref;
            }

            const topicId = topicDocRef.id;
            const topicDoc = await topicDocRef.get();
            const topicData = topicDoc.data();

            // 3. [핵심] 이제 주제가 반드시 존재하므로, 댓글 토론장 UI를 무조건 그립니다.
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
                            <input type="password" id="comment-password" placeholder="비밀번호 (삭제 시 필요)" required>
                        </div>
                        <textarea id="comment-text" placeholder="주제에 대한 당신의 생각을 자유롭게 나눠주세요." required></textarea>
                        <button type="submit">댓글 등록</button>
                    </form>
                </div>
            `;

            const commentsList = document.getElementById('comments-list');
            const commentForm = document.getElementById('comment-form');

            // 4. 댓글 목록을 실시간으로 가져와 표시합니다.
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
                                <button class="delete-comment-btn">삭제</button>
                            `;
                            commentsList.appendChild(commentEl);
                        });
                    }
                });

            // 5. 댓글 등록 이벤트를 처리합니다.
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

            // 6. 댓글 삭제 이벤트를 처리합니다.
            commentsList.addEventListener('click', async (e) => {
                if (!e.target.classList.contains('delete-comment-btn')) return;
                const commentItem = e.target.closest('.comment-item');
                const commentId = commentItem.dataset.id;
                const enteredPassword = prompt('댓글을 삭제하려면 비밀번호를 입력하세요.');
                if (!enteredPassword) return;

                const commentRef = db.collection('posts').doc(topicId).collection('comments').doc(commentId);
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
            });

        } catch (error) {
            console.error("게시판 렌더링 최종 오류:", error);
            boardContainer.innerHTML = '<p style="color:red; text-align:center; font-weight:bold;">죄송합니다. 게시판을 표시하는 데 실패했습니다. 페이지를 새로고침해주세요.</p>';
        }
    };

    renderGuaranteedTopicBoard();
});
