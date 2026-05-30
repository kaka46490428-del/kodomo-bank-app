const familyId = 'takahashi-family';

let childId =
  localStorage.getItem('dreamSelectedChildId') || 'default-child';

let childName =
  localStorage.getItem('dreamSelectedChildName') || 'こども';
  
function showScreen(screenId){

  const screens = document.querySelectorAll('.screen');

  screens.forEach(screen => {
    screen.classList.remove('active');
  });

  document.getElementById(screenId).classList.add('active');

}

let balance = 1000;

function addTransaction(type){

  const titleInput =
    document.getElementById('trade-title');

  const amountInput =
    document.getElementById('trade-amount');

  const list =
    document.getElementById('transaction-list');

  const balanceText =
    document.getElementById('balance');

  const homeBalanceText =
    document.getElementById('home-balance');

  const title = titleInput.value;

  const amount =
    Number(amountInput.value);

  if(title === '' || amount <= 0){

    alert('内容と金額を入力してください');

    return;

  }

  if(type === 'income'){

    balance += amount;

  }else{

    balance -= amount;

  }

  balanceText.textContent =
    balance + ' Dream円';

  if(homeBalanceText){

    homeBalanceText.textContent =
      balance + ' Dream円';

  }

  const sign =
    type === 'income' ? '+' : '-';

  const item =
    document.createElement('div');

  item.classList.add('passbook-row');

  if(type === 'income'){

    item.classList.add('income');

  }else{

    item.classList.add('expense');

  }

  item.innerHTML = `
    <div>今日</div>
    <div>${title}</div>
    <div>${sign}${amount}円</div>
  `;

  list.prepend(item);

  titleInput.value = '';

  amountInput.value = '';

  updateGoal();
  saveData();

}

function saveData(){

  localStorage.setItem(
    'dreamBalance',
    balance
  );

  localStorage.setItem(
    'dreamTransactions',
    document.getElementById('transaction-list').innerHTML
  );

  localStorage.setItem(
    'dreamApprovals',
    document.getElementById('approval-list').innerHTML
  );

  saveDataToFirestore();

}

function updateGoal(){

  const targetAmount = 10000;

  const currentText =
    document.getElementById('goal-current');

  const targetText =
    document.getElementById('goal-target');

  const progress =
    document.getElementById('goal-progress');

  const remainingText =
    document.getElementById('goal-remaining');

  const stageIcon =
    document.getElementById('goal-stage-icon');

  const stageTitle =
    document.getElementById('goal-stage-title');

  const message =
    document.getElementById('goal-message');

  if(!currentText){
    return;
  }

  currentText.textContent = balance;
  targetText.textContent = targetAmount;

  const percent =
    Math.min((balance / targetAmount) * 100, 100);

  progress.style.width = percent + '%';

  const remaining =
    Math.max(targetAmount - balance, 0);

  remainingText.textContent =
    remaining === 0
      ? '目標達成！お城が完成したよ！'
      : 'あと' + remaining + ' Dream円で目標達成！';

  if(balance < 500){
    stageIcon.textContent = '🌱';
    stageTitle.textContent = '小さな芽';
    message.textContent = 'これから大きく育つよ！';
  }else if(balance < 1000){
    stageIcon.textContent = '🌷';
    stageTitle.textContent = '花が咲いたよ';
    message.textContent = '少しずつ世界が明るくなってきたね！';
  }else if(balance < 5000){
    stageIcon.textContent = '🌳';
    stageTitle.textContent = '大きな木';
    message.textContent = '貯金の力で木が育ったよ！';
  }else if(balance < 10000){
    stageIcon.textContent = '🏠';
    stageTitle.textContent = '小さなお家';
    message.textContent = 'もう少しで夢のお城だよ！';
  }else{
    stageIcon.textContent = '🏰';
    stageTitle.textContent = '夢のお城 完成！';
    message.textContent = '目標達成おめでとう！';
  }

}

function loadData(){

  const savedBalance =
    localStorage.getItem('dreamBalance');

  const savedTransactions =
    localStorage.getItem('dreamTransactions');

  const savedApprovals =
    localStorage.getItem('dreamApprovals');

  if(savedBalance){

    balance = Number(savedBalance);

    document.getElementById('balance').textContent =
      balance + ' Dream円';

    const homeBalanceText =
      document.getElementById('home-balance');

    if(homeBalanceText){

      homeBalanceText.textContent =
        balance + ' Dream円';

    }

  }

  if(savedTransactions){

    document.getElementById('transaction-list').innerHTML =
      savedTransactions;

  }

  if(savedApprovals){

    document.getElementById('approval-list').innerHTML =
      savedApprovals;

  }

  const savedMode =
  localStorage.getItem('dreamInputMode');

if(savedMode){

  document.getElementById('input-mode').value =
    savedMode;

  changeInputMode();

}

}

async function initializeAppData(){

  await loadDataFromFirestore();

  updateGoal();

  changeInputMode();

  listenRealtimeData();

  renderChildList();

}

if(window.db && window.doc){

  initializeAppData();

}else{

  window.addEventListener(
    'firebase-ready',
    initializeAppData
  );

}

async function saveDataToFirestore(){

  await window.setDoc(
    window.doc(window.db, 'families', familyId, 'children', childId),
    {
      balance: balance,
      transactionsHtml:
        document.getElementById('transaction-list').innerHTML,

      approvalsHtml:
        document.getElementById('approval-list').innerHTML,

      updatedAt: new Date().toISOString()
    }
  );

  console.log('Firestore saved!');

}

function completeMission(button){

  const missionCard =
    button.parentElement;

  const title =
    missionCard.querySelector('h2').textContent;

  const rewardText =
    missionCard.querySelectorAll('p')[0].textContent;

  const reward =
    Number(
      rewardText.replace('報酬：','')
      .replace(' Dream円','')
    );

  const now = new Date();

const dateTime =
  now.getFullYear() + '/' +
  String(now.getMonth() + 1).padStart(2, '0') + '/' +
  String(now.getDate()).padStart(2, '0') + ' ' +
  String(now.getHours()).padStart(2, '0') + ':' +
  String(now.getMinutes()).padStart(2, '0');

  const approvalList =
    document.getElementById('approval-list');

  const item =
    document.createElement('div');

  item.classList.add('approval-card');

  item.innerHTML = `
  <div>
    <h2>${title}</h2>
    <p>${reward} Dream円</p>
    <p class="approval-date">${dateTime}</p>
  </div>

  <button onclick="approveMission(this, '${title}', ${reward})">
    承認
  </button>
`;

  approvalList.prepend(item);

  button.textContent = '承認待ち';

  button.disabled = true;

  button.style.background = '#aaa';

  button.style.boxShadow = 'none';

  saveData();

  alert('おしごと完了！承認待ちになりました');

}

function approveMission(button, title, reward){

  balance += reward;

  document.getElementById('balance').textContent =
    balance + ' Dream円';

  const homeBalance =
    document.getElementById('home-balance');

  if(homeBalance){

    homeBalance.textContent =
      balance + ' Dream円';

  }

  const list =
    document.getElementById('transaction-list');

  const item =
    document.createElement('div');

  item.classList.add('passbook-row');
  item.classList.add('income');

  item.innerHTML = `
    <div>${new Date().toLocaleDateString()}</div>
    <div>🧹 ${title}</div>
    <div>+${reward}円</div>
  `;

  list.prepend(item);

  button.parentElement.remove();

  updateGoal();
  saveData();

  alert('承認しました！');

}

function convertTradeTitleToHiragana(){

  const input =
    document.getElementById('trade-title');

  if(!input){
    return;
  }

  input.value =
    input.value
      .replace(/[ァ-ン]/g, function(s){
        return String.fromCharCode(
          s.charCodeAt(0) - 0x60
        );
      });

}

function changeInputMode(){

  const mode =
    document.getElementById('input-mode').value;

  const tradeTitle =
    document.getElementById('trade-title');

  if(!tradeTitle){
    return;
  }

  if(mode === 'kana'){

    tradeTitle.setAttribute(
      'inputmode',
      'kana'
    );

    tradeTitle.setAttribute(
      'placeholder',
      'ないようをにゅうりょく'
    );

  }else{

    tradeTitle.setAttribute(
      'inputmode',
      'text'
    );

    tradeTitle.setAttribute(
      'placeholder',
      '内容を入力'
    );

  }

  localStorage.setItem(
    'dreamInputMode',
    mode
  );

}

async function loadDataFromFirestore(){

  const docRef = window.doc(
    window.db,
    'families',
    familyId,
    'children',
    childId
  );

  const docSnap = await window.getDoc(docRef);

  if(docSnap.exists()){

    const data = docSnap.data();

    balance = data.balance || 0;

    document.getElementById('balance').textContent =
      balance + ' Dream円';

    const homeBalance =
      document.getElementById('home-balance');

    if(homeBalance){

      homeBalance.textContent =
        balance + ' Dream円';

    }

    if(data.transactionsHtml){

      document.getElementById('transaction-list').innerHTML =
        data.transactionsHtml;

    }

    if(data.approvalsHtml){

      document.getElementById('approval-list').innerHTML =
        data.approvalsHtml;

    }

    console.log('Firestore loaded!');

  }

}

function listenRealtimeData(){

  const docRef = window.doc(
    window.db,
    'families',
    familyId,
    'children',
    childId
  );

  window.onSnapshot(docRef, function(docSnap){

    if(docSnap.exists()){

      const data = docSnap.data();

      balance = data.balance || 0;

      document.getElementById('balance').textContent =
        balance + ' Dream円';

      const homeBalance =
        document.getElementById('home-balance');

      if(homeBalance){
        homeBalance.textContent = balance + ' Dream円';
      }

      if(data.transactionsHtml){
        document.getElementById('transaction-list').innerHTML =
          data.transactionsHtml;
      }

      if(data.approvalsHtml){
        document.getElementById('approval-list').innerHTML =
          data.approvalsHtml;
      }

      updateGoal();

      console.log('Realtime updated!');

    }

  });

}