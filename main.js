document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop(); // 예: "information.html"
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        
        // 현재 페이지와 링크의 href가 일치하면 'active' 클래스 추가
        // (index.html의 경우 currentPage가 비어있을 수 있으므로 예외 처리)
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        }
    });

    // "글쓰기" 버튼 클릭 시 임시 알림
    const writeButton = document.querySelector('.write-post-btn');
    if (writeButton) {
        writeButton.addEventListener('click', () => {
            alert('글쓰기 기능은 Firebase 연동 후 구현될 예정입니다.');
        });
    }
});