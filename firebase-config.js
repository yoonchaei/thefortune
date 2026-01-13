try {
  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyC938GT-8vdKkCDPCjUIvuXzd-J65Wielk",
    authDomain: "the-fortune-pwa.firebaseapp.com",
    projectId: "the-fortune-pwa",
    storageBucket: "the-fortune-pwa.appspot.com",
    messagingSenderId: "736715560458",
    appId: "1:736715560458:web:4cd993cd5ff0b8f9edf1f3"
  };

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase가 CDN과 로컬 설정을 통해 성공적으로 초기화되었습니다.");

} catch (e) {
  console.error("Firebase 초기화 중 심각한 오류가 발생했습니다:", e);
  alert("Firebase 초기화에 실패했습니다. 사이트 관리자에게 문의하세요.");
}
