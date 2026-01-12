document.addEventListener('DOMContentLoaded', () => {
    // Firebase 앱이 초기화되었는지 확인
    const checkFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            clearInterval(checkFirebase);
            initializeBoard();
        }
    }, 100);

    function initializeBoard() {
        const db = firebase.firestore();
        const category = document.body.dataset.category;
        const postsList = document.querySelector('.posts-list');

        if (!postsList) return;

        // 실시간으로 게시글(주제) 목록 가져오기
        db.collection('posts')
          .where('category', '==', category)
          .orderBy('createdAt', 'desc')
          .onSnapshot(snapshot => {
              if (snapshot.empty) {
                  postsList.innerHTML = '<p>아직 등록된 주제가 없습니다. 관리자가 곧 흥미로운 주제를 추가할 예정입니다.</p>';
                  return;
              }

              let html = '';
              snapshot.forEach(doc => {
                  const post = doc.data();
                  const postId = doc.id;
                  html += `
                      <div class="post" id="post-${postId}">
                          <h3>${post.title}</h3>
                          <p>${post.content}</p>
                          
                          <!-- 댓글 섹션 -->
                          <div class="comments-section">
                              <h4><i class="icon-comment"></i> 댓글</h4>
                              <div class="comments-list" id="comments-${postId}">
                                  <!-- 댓글이 여기에 렌더링됩니다 -->
                              </div>
                              <form class="comment-form" data-post-id="${postId}">
                                  <textarea name="comment-text" placeholder="댓글을 남겨보세요..." required></textarea>
                                  <button type="submit">등록</button>
                              </form>
                          </div>
                      </div>
                  `;
              });
              postsList.innerHTML = html;
              
              // 각 게시글에 대한 댓글 로드 및 이벤트 리스너 설정
              snapshot.forEach(doc => {
                  loadComments(doc.id);
                  setupCommentFormListener(doc.id);
              });
          }, err => {
              console.error("Error fetching posts: ", err);
              postsList.innerHTML = '<p>주제를 불러오는 데 실패했습니다. 다시 시도해 주세요.</p>';
          });
    }

    // 댓글 불러오기
    function loadComments(postId) {
        const commentsList = document.querySelector(`#comments-${postId}`);
        if (!commentsList) return;

        const db = firebase.firestore();
        db.collection('posts').doc(postId).collection('comments')
          .orderBy('createdAt', 'asc')
          .onSnapshot(snapshot => {
              let commentsHtml = '';
              if (snapshot.empty) {
                  commentsHtml = '<p class="no-comments">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>';
              } else {
                  snapshot.forEach(doc => {
                      const comment = doc.data();
                      const commentId = doc.id;
                      commentsHtml += `
                          <div class="comment" id="comment-${commentId}">
                              <p class="comment-text">${comment.text}</p>
                              <div class="comment-actions">
                                  <button class="reply-btn" data-comment-id="${commentId}">답글 달기</button>
                                  <button class="delete-comment-btn" data-comment-id="${commentId}" data-post-id="${postId}">삭제</button>
                              </div>
                              <!-- 대댓글 입력 폼 (초기에는 숨김) -->
                              <form class="reply-form" id="reply-form-${commentId}" data-post-id="${postId}" data-comment-id="${commentId}" style="display:none;">
                                  <textarea name="reply-text" placeholder="대댓글을 작성하세요..." required></textarea>
                                  <button type="submit">답글 등록</button>
                              </form>
                              <!-- 대댓글 목록 -->
                              <div class="replies-list" id="replies-${commentId}">${renderReplies(comment.replies || [])}</div>
                          </div>
                      `;
                  });
              }
              commentsList.innerHTML = commentsHtml;
              setupActionButtons(postId);
          }, err => {
              console.error("Error fetching comments: ", err);
              commentsList.innerHTML = '<p>댓글을 불러오는 데 실패했습니다.</p>';
          });
    }
    
    // 대댓글 렌더링
    function renderReplies(replies) {
        if (!replies || replies.length === 0) return '';
        return replies.map(reply => `
            <div class="reply">
                <p class="reply-text">${reply.text}</p>
            </div>
        `).join('');
    }

    // 댓글 폼 제출 리스너
    function setupCommentFormListener(postId) {
        const form = document.querySelector(`form[data-post-id="${postId}"]`);
        if (!form) return;

        form.addEventListener('submit', e => {
            e.preventDefault();
            const textarea = form.querySelector('textarea');
            const text = textarea.value.trim();
            if (!text) return;

            const db = firebase.firestore();
            db.collection('posts').doc(postId).collection('comments').add({
                text: text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                replies: []
            }).then(() => {
                textarea.value = ''; // 성공 시 텍스트 초기화
            }).catch(err => {
                console.error("Error adding comment: ", err);
                alert('댓글 등록에 실패했습니다.');
            });
        });
    }

    // '답글달기', '삭제' 등 액션 버튼 리스너
    function setupActionButtons(postId) {
        const postElement = document.querySelector(`#post-${postId}`);
        if(!postElement) return;

        postElement.addEventListener('click', e => {
            // 답글달기 버튼 클릭
            if (e.target.classList.contains('reply-btn')) {
                const commentId = e.target.dataset.commentId;
                const replyForm = document.querySelector(`#reply-form-${commentId}`);
                if (replyForm) {
                    replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
                }
            }

            // 댓글 삭제 버튼 클릭
            if (e.target.classList.contains('delete-comment-btn')) {
                const commentId = e.target.dataset.commentId;
                if(confirm('이 댓글을 정말 삭제하시겠습니까?')) {
                    deleteComment(postId, commentId);
                }
            }
        });
        
        // 대댓글 폼 제출
        const replyForms = postElement.querySelectorAll('.reply-form');
        replyForms.forEach(form => {
            // 기존 리스너를 제거하여 중복 방지
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);

            newForm.addEventListener('submit', e => {
                e.preventDefault();
                const textarea = newForm.querySelector('textarea');
                const text = textarea.value.trim();
                const commentId = newForm.dataset.commentId;
                if(!text) return;
                
                addReply(postId, commentId, text);
                textarea.value = '';
                newForm.style.display = 'none';
            });
        });
    }

    // 댓글 삭제 함수
    function deleteComment(postId, commentId) {
        const db = firebase.firestore();
        db.collection('posts').doc(postId).collection('comments').doc(commentId).delete()
        .catch(err => {
            console.error("Error deleting comment: ", err);
            alert('댓글 삭제에 실패했습니다.');
        });
    }

    // 대댓글 추가 함수
    function addReply(postId, commentId, text) {
        const db = firebase.firestore();
        const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);

        commentRef.update({
            replies: firebase.firestore.FieldValue.arrayUnion({
                text: text,
                createdAt: new Date() // 서버 타임스탬프는 배열에 직접 사용하기 복잡하므로 클라이언트 시간 사용
            })
        }).catch(err => {
            console.error("Error adding reply: ", err);
            alert('답글 등록에 실패했습니다.');
        });
    }
});