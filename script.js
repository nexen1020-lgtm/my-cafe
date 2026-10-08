// ===================================================
// [Supabase 설정 정보]
// - 본인의 Supabase 프로젝트 대시보드 (Settings -> API)에서 확인한
//   Project URL과 anon public Key를 아래 따옴표 안에 직접 넣어주세요.
// ===================================================
const SUPABASE_URL = 'https://iqqcciwezgxnedlzjsdb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxcWNjaXdlemd4bmVkbHpqc2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTMyNTUsImV4cCI6MjEwNjk4OTI1NX0.-K-Ja7cvq9kiLhzk1onNZWfqcUhESV3Ra5CEt5qA4S4';

// Supabase 클라이언트 객체 생성 (CDN으로 로드된 supabase 라이브러리 활용)
// 요구사항 변수명: supabaseClient
const supabaseClient = (typeof supabase !== 'undefined' && supabase.createClient)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ===================================================
// 바이브 카페 (Vibe Cafe) 주문 페이지 스크립트
// ===================================================

// HTML 문서가 완전히 불러와진 후에 스크립트가 실행되도록 합니다.
document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------
  // 1. 필요한 HTML 요소(DOM)들을 id를 이용해 가져오기
  // --------------------------------------------------
  // [탭 관련 요소]
  const tabOrderBtn = document.getElementById('tab-order-btn');           // '주문하기' 탭 버튼
  const tabHistoryBtn = document.getElementById('tab-history-btn');       // '주문 내역' 탭 버튼
  const orderTabContent = document.getElementById('order-tab-content');   // 주문하기 탭 내용 영역
  const historyTabContent = document.getElementById('history-tab-content'); // 주문 내역 탭 내용 영역
  const orderBadge = document.getElementById('order-badge');               // 주문 건수 배지

  // [주문 폼 관련 요소]
  const orderForm = document.getElementById('order-form');                 // 주문 폼 전체
  const customerName = document.getElementById('customer-name');           // 고객 이름 입력칸
  const customerPhone = document.getElementById('customer-phone');         // 전화번호 입력칸
  const menuSelect = document.getElementById('menu-select');               // 음료 선택 셀렉트 박스
  const quantityInput = document.getElementById('quantity');               // 수량 입력칸
  const requestsInput = document.getElementById('requests');               // 요청사항 입력칸
  const estimatedPriceSpan = document.getElementById('estimated-price');   // 예상 금액 표시 영역 (span)
  const orderConfirmation = document.getElementById('order-confirmation'); // 주문 확인 메시지 표시 영역
  const submitBtn = document.getElementById('submit-btn');                 // '주문하기' 버튼

  // [주문 내역 관련 요소]
  const ordersList = document.getElementById('orders-list');               // 주문 내역 카드들이 들어갈 목록
  const ordersSummaryArea = document.getElementById('orders-summary-area'); // 총 주문 금액 및 전체 삭제 영역
  const totalOrdersSummary = document.getElementById('total-orders-summary'); // 총 금액 및 건수 요약 텍스트
  const printOrdersBtn = document.getElementById('print-orders-btn');     // '인쇄하기' 버튼
  const clearAllOrdersBtn = document.getElementById('clear-all-orders-btn'); // '내역 모두 지우기' 버튼

  // --------------------------------------------------
  // 2. 주문 데이터 관리 변수
  // --------------------------------------------------
  let orders = [];       // 주문 객체들을 저장할 배열
  let orderNumberSeq = 0; // 로컬 주문 번호 부여용 변수 (1, 2, 3...)

  // --------------------------------------------------
  // 3. 탭 전환 기능
  //    - 기존 hidden 클래스를 활용하여 화면 표시/숨김을 제어합니다.
  // --------------------------------------------------
  // 1) '주문하기' 탭 클릭 시
  tabOrderBtn.addEventListener('click', () => {
    tabOrderBtn.classList.add('active');
    tabHistoryBtn.classList.remove('active');

    orderTabContent.classList.remove('hidden');
    historyTabContent.classList.add('hidden');
  });

  // 2) '주문 내역' 탭 클릭 시
  tabHistoryBtn.addEventListener('click', () => {
    tabHistoryBtn.classList.add('active');
    tabOrderBtn.classList.remove('active');

    historyTabContent.classList.remove('hidden');
    orderTabContent.classList.add('hidden');

    // 탭을 열 때 최신 주문 목록을 다시 그려줍니다.
    renderOrders();
  });

  // --------------------------------------------------
  // 4. 예상 금액 계산 함수 (calculateTotal)
  //    - 음료, 사이즈, 옵션, 수량을 바탕으로 총 금액을 계산하고
  //    - 화면의 '예상 금액'을 천 단위 콤마(toLocaleString)와 함께 갱신합니다.
  // --------------------------------------------------
  function calculateTotal() {
    // [1단계] 음료 기본 가격 가져오기
    const selectedMenuOption = menuSelect.options[menuSelect.selectedIndex];
    const menuPrice = parseInt(selectedMenuOption?.dataset?.price || '0', 10);

    // [음료를 아직 고르지 않은 경우]
    if (!menuSelect.value || menuPrice === 0) {
      estimatedPriceSpan.textContent = '0원';
      return 0;
    }

    // [2단계] 사이즈 추가 금액 가져오기
    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizePrice = parseInt(selectedSizeRadio?.dataset?.price || '0', 10);

    // [3단계] 추가 옵션 금액 합산하기
    const checkedOptions = document.querySelectorAll('input[name="option"]:checked');
    let optionPriceTotal = 0;
    checkedOptions.forEach((option) => {
      optionPriceTotal += parseInt(option.dataset.price || '0', 10);
    });

    // [4단계] 수량 확인하기 (최소 1)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // [5단계] 최종 총 금액 계산
    const totalPrice = (menuPrice + sizePrice + optionPriceTotal) * quantity;

    // [6단계] 화면에 천 단위 콤마 표시하기 (예: 5,000원)
    estimatedPriceSpan.textContent = `${totalPrice.toLocaleString()}원`;

    return totalPrice;
  }

  // 실시간 변경 이벤트 감지 (폼 변경 시 즉시 금액 다시 계산)
  orderForm.addEventListener('change', calculateTotal);
  quantityInput.addEventListener('input', calculateTotal);

  // --------------------------------------------------
  // 5. 주문 내역 화면 렌더링 함수 (renderOrders)
  //    - orders 배열의 데이터를 바탕으로 주문 내역 탭을 화면에 그립니다.
  //    - 보안을 위해 사용자가 입력한 문자열은 innerHTML이 아닌 textContent를 사용합니다.
  // --------------------------------------------------
  function renderOrders() {
    // 1) 탭 옆의 둥근 갈색 배지 건수 갱신
    orderBadge.textContent = orders.length;

    // 2) 기존 목록 화면 비우기
    ordersList.innerHTML = '';

    // 3) 주문 내역이 하나도 없을 때
    if (orders.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'empty-orders';
      emptyNotice.textContent = '아직 주문 내역이 없어요 ☕';
      ordersList.appendChild(emptyNotice);

      // 하단 요약 영역 숨기기 (hidden 클래스 재사용)
      ordersSummaryArea.classList.add('hidden');
      return;
    }

    // 4) 주문 내역이 있을 때 요약 영역 보이기
    ordersSummaryArea.classList.remove('hidden');

    // 총 주문 금액 합산 변수
    let grandTotal = 0;

    // 5) orders 배열을 순회하며 카드 생성 (배열 앞쪽에 최신 주문이 위치)
    orders.forEach((order) => {
      grandTotal += order.totalPrice;

      // [카드 컨테이너] (베이지 배경 + 왼쪽 갈색 세로줄)
      const card = document.createElement('div');
      card.className = 'order-card';

      // [카드 오른쪽 위 '취소' 버튼]
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'order-cancel-btn';
      cancelBtn.textContent = '취소';

      // 취소 버튼 클릭 시 confirm으로 재확인 후 삭제
      cancelBtn.addEventListener('click', () => {
        const isConfirmed = confirm(`#${order.id} ${order.name}님의 주문을 취소하시겠습니까?`);
        if (isConfirmed) {
          // 해당 주문을 배열에서 제거
          orders = orders.filter((item) => item.id !== order.id);
          // 화면 다시 그리기
          renderOrders();
        }
      });
      card.appendChild(cancelBtn);

      // [1줄: "#1 홍길동님 · 5,000원"]
      const line1 = document.createElement('div');
      line1.className = 'order-card-line1';
      // 보안: 손님이 입력한 이름(order.name)을 textContent로 안전하게 삽입
      line1.textContent = `#${order.id} ${order.name}님 · ${order.totalPrice.toLocaleString()}원`;
      card.appendChild(line1);

      // [2줄: "카페라떼 M사이즈 (샷 추가) 1잔"]
      const line2 = document.createElement('div');
      line2.className = 'order-card-line2';
      const optionText = order.options.length > 0 ? `(${order.options.join(', ')}) ` : '';
      line2.textContent = `${order.menu} ${order.size}사이즈 ${optionText}${order.quantity}잔`;
      card.appendChild(line2);

      // [3줄: 요청사항(있을 때만) · 주문 시간]
      const line3 = document.createElement('div');
      line3.className = 'order-card-line3';
      // 보안: 손님이 입력한 요청사항(order.requests)을 textContent로 안전하게 삽입
      if (order.requests) {
        line3.textContent = `${order.requests} · ${order.orderTime}`;
      } else {
        line3.textContent = order.orderTime;
      }
      card.appendChild(line3);

      // 완성된 카드를 목록에 추가
      ordersList.appendChild(card);
    });

    // 6) 하단 총 주문 금액 및 건수 업데이트
    totalOrdersSummary.textContent = `총 주문 금액: ${grandTotal.toLocaleString()}원 (${orders.length}건)`;
  }

  // --------------------------------------------------
  // 6. 주문하기 버튼 클릭 (폼 제출: submit) 이벤트
  //    - 유효성 검사 후 Supabase orders 테이블에 주문을 저장합니다.
  //    - 저장 중에는 버튼을 비활성화하여 중복 클릭을 방지합니다.
  // --------------------------------------------------
  orderForm.addEventListener('submit', async (event) => {
    // 폼 제출 시 브라우저가 새로고침되는 기본 동작을 방지합니다.
    event.preventDefault();

    // 1) 이름 입력 여부 확인
    const name = customerName.value.trim();
    if (!name) {
      alert('이름을 입력해주세요');
      customerName.focus();
      return;
    }

    // 2) 전화번호 입력 여부 확인
    const phone = customerPhone.value.trim();
    if (!phone) {
      alert('전화번호를 입력해주세요');
      customerPhone.focus();
      return;
    }

    // 3) 음료 선택 여부 확인
    if (!menuSelect.value) {
      alert('음료를 선택해주세요');
      menuSelect.focus();
      return;
    }

    // 4) 주문 정보 추출
    const totalPrice = calculateTotal();

    // 선택된 음료 정보 추출
    const selectedMenuOption = menuSelect.options[menuSelect.selectedIndex];
    const menuName = selectedMenuOption.text.replace(/\s*[0-9,]+원/, '').trim(); // 음료 이름 (drink)
    const menuPrice = parseInt(selectedMenuOption?.dataset?.price || '0', 10);    // 음료 기본 가격 (drink_price)

    // 선택된 사이즈 가져오기 (S, M, L)
    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizeName = selectedSizeRadio ? selectedSizeRadio.value : 'M';

    // 선택된 추가 옵션 이름들 추출 (배열 형태)
    const checkedOptions = document.querySelectorAll('input[name="option"]:checked');
    const optionNames = [];
    checkedOptions.forEach((option) => {
      const label = document.querySelector(`label[for="${option.id}"]`);
      if (label) {
        const cleanOptionName = label.textContent.replace(/\s*\+[0-9,]+원/, '').trim();
        optionNames.push(cleanOptionName);
      }
    });

    // 옵션 문구 (옵션이 없으면 괄호 생략)
    const optionText = optionNames.length > 0 ? `(${optionNames.join(', ')}) ` : '';

    // 수량 및 요청사항
    const quantity = parseInt(quantityInput.value, 10) || 1;
    const requests = requestsInput.value.trim();

    // 주문 시간 (예: "오후 1:23")
    const now = new Date();
    const orderTime = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // --------------------------------------------------
    // [Supabase DB 저장 처리]
    // --------------------------------------------------
    // 1) 버튼 비활성화 (두 번 눌리지 않게 처리)
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = '주문 저장 중...';

    try {
      // Supabase 클라이언트 확인
      if (!supabaseClient) {
        throw new Error('Supabase 클라이언트가 설정되지 않았습니다. SUPABASE_URL과 SUPABASE_KEY를 확인해주세요.');
      }

      // Supabase 'orders' 테이블에 저장할 데이터 객체 구성
      // 실제 테이블 컬럼: customer_name, customer_phone, menu, size, options, quantity, requests, total_price
      const orderPayload = {
        customer_name: name,
        customer_phone: phone, // phone -> customer_phone
        menu: menuName,         // drink -> menu
        size: sizeName,
        options: optionNames,
        quantity: quantity,
        requests: requests,     // request -> requests
        total_price: totalPrice
      };

      // orders 테이블에 데이터 삽입(INSERT)
      const { data, error } = await supabaseClient
        .from('orders')
        .insert([orderPayload])
        .select();

      // 에러가 반환된 경우 예외 발생
      if (error) {
        throw error;
      }

      // --------------------------------------------------
      // [저장 성공 시 처리]
      // --------------------------------------------------
      // DB에서 생성된 id가 있으면 사용하고, 없으면 시퀀스 번호 사용
      const generatedId = (data && data.length > 0 && data[0].id) ? data[0].id : ++orderNumberSeq;

      // 로컬 주문 객체 생성 및 배열에 추가
      const newOrder = {
        id: generatedId,
        name: name,
        phone: phone,
        menu: menuName,
        size: sizeName,
        options: optionNames,
        quantity: quantity,
        requests: requests,
        totalPrice: totalPrice,
        orderTime: orderTime
      };

      orders.unshift(newOrder); // 최신 주문을 목록 맨 위에 추가
      renderOrders();           // 주문 내역 화면 갱신

      // 기존 주문 확인 메시지 표시
      const confirmationMessage = `${name}님, ${menuName} ${sizeName}사이즈 ${optionText}${quantity}잔, 총 ${totalPrice.toLocaleString()}원 주문이 접수되었습니다!`;

      orderConfirmation.textContent = confirmationMessage;
      orderConfirmation.hidden = false;
      orderConfirmation.classList.remove('hidden');

      // 확인 메시지 애니메이션 재생
      orderConfirmation.style.animation = 'none';
      orderConfirmation.offsetHeight; // 리플로우 유도
      orderConfirmation.style.animation = '';

      // 확인 메시지 영역으로 부드럽게 스크롤
      orderConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      // --------------------------------------------------
      // [저장 실패 시 처리]
      // --------------------------------------------------
      alert('주문 저장에 실패했어요');
      console.error('주문 저장 실패 에러 상세:', err);
    } finally {
      // --------------------------------------------------
      // [완료 후 버튼 복원]
      // --------------------------------------------------
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  // --------------------------------------------------
  // 7. 주문 내역 인쇄하기 버튼 이벤트
  //    - 주문 내역이 있을 때 브라우저 인쇄 대화상자(window.print)를 호출합니다.
  // --------------------------------------------------
  printOrdersBtn.addEventListener('click', () => {
    if (orders.length === 0) {
      alert('인쇄할 주문 내역이 없습니다.');
      return;
    }

    // 브라우저 인쇄 실행 (@media print 스타일 적용)
    window.print();
  });

  // --------------------------------------------------
  // 8. 내역 모두 지우기 버튼 이벤트
  // --------------------------------------------------
  clearAllOrdersBtn.addEventListener('click', () => {
    if (orders.length === 0) return;

    const isConfirmed = confirm('모든 주문 내역을 삭제하시겠습니까?');
    if (isConfirmed) {
      orders = [];
      renderOrders();
    }
  });

  // --------------------------------------------------
  // 9. 다시 작성 버튼 (초기화: reset) 이벤트
  //    - 주문서 폼만 초기화하고 주문 내역(orders)은 지우지 않습니다.
  // --------------------------------------------------
  orderForm.addEventListener('reset', () => {
    setTimeout(() => {
      // M 사이즈 기본 선택
      const sizeMRadio = document.getElementById('size-m');
      if (sizeMRadio) {
        sizeMRadio.checked = true;
      }

      // 수량 1로 복귀
      quantityInput.value = 1;

      // 예상 금액 0원으로 재계산
      calculateTotal();

      // 주문 확인 메시지 숨기기 (주문 내역 orders는 유지)
      orderConfirmation.hidden = true;
      orderConfirmation.classList.add('hidden');
      orderConfirmation.textContent = '';
    }, 0);
  });

  // --------------------------------------------------
  // 10. 초기 화면 세팅
  // --------------------------------------------------
  calculateTotal(); // 최초 로드 시 예상 금액 0원 설정
  renderOrders();   // 최초 로드 시 배지(0) 및 빈 주문 내역 안내 표시
});
