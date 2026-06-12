// ============================================
// 家族ID（招待コード対応：固定 → localStorage）
// ============================================

let familyId =
  localStorage.getItem('dreamFamilyId') || null;

let familyName =
  localStorage.getItem('dreamFamilyName') || '';

let bankName =
  localStorage.getItem('dreamBankName') || '';

let inviteCode =
  localStorage.getItem('dreamInviteCode') || '';

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

let unsubscribeRealtime = null;

// ============================================
// 招待コード生成（紛らわしい文字 0/O/1/I を除外）
// ============================================

function generateInviteCode(){

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let code = '';

  for(let i = 0; i < 6; i++){

    code += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );

  }

  return code;

}

// ============================================
// 子供銀行（家族）を新規作成
// ============================================

async function createFamily(){

  const familyNameInput =
    document.getElementById('family-name-input');

  const bankNameInput =
    document.getElementById('bank-name-input');

  const newFamilyName =
    familyNameInput.value.trim();

  const newBankName =
    bankNameInput.value.trim();

  if(newFamilyName === '' || newBankName === ''){
    alert('家族名と銀行名を入力してください');
    return;
  }

  familyId = 'family_' + Date.now();
  familyName = newFamilyName;
  bankName = newBankName;
  inviteCode = generateInviteCode();

  await window.setDoc(
    window.doc(window.db, 'families', familyId),
    {
      familyName: familyName,
      bankName: bankName,
      inviteCode: inviteCode,
      children: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );

  localStorage.setItem('dreamFamilyId', familyId);
  localStorage.setItem('dreamFamilyName', familyName);
  localStorage.setItem('dreamBankName', bankName);
  localStorage.setItem('dreamInviteCode', inviteCode);

  // 新しい家族なので子供リストをリセット
  localStorage.setItem('dreamChildren', '[]');

  console.log('Family created! code: ' + inviteCode);

  alert(
    '子供銀行を作成しました！\n\n' +
    '招待コード：' + inviteCode + '\n\n' +
    '家族のスマホやPCから、このコードで参加できます\n' +
    '（設定画面からいつでも確認できます）'
  );

  showScreen('child-screen');

}

// ============================================
// 招待コードで既存の家族に参加
// ============================================

async function joinFamily(){

  const codeInput =
    document.getElementById('invite-code-input');

  const code =
    codeInput.value.trim().toUpperCase();

  if(code.length !== 6){
    alert('6文字の招待コードを入力してください');
    return;
  }

  const q = window.query(
    window.collection(window.db, 'families'),
    window.where('inviteCode', '==', code)
  );

  const snapshot = await window.getDocs(q);

  if(snapshot.empty){
    alert('招待コードが見つかりません。\nコードを確認してもう一度入力してください');
    return;
  }

  const familyDoc = snapshot.docs[0];
  const data = familyDoc.data();

  familyId = familyDoc.id;
  familyName = data.familyName || '';
  bankName = data.bankName || '';
  inviteCode = data.inviteCode || code;
  parentPin = data.parentPin || '';

  localStorage.setItem('dreamFamilyId', familyId);
  localStorage.setItem('dreamFamilyName', familyName);
  localStorage.setItem('dreamBankName', bankName);
  localStorage.setItem('dreamInviteCode', inviteCode);
  localStorage.setItem('dreamParentPin', parentPin);

  // 家族の子供リストを取得
  const children = data.children || [];

  localStorage.setItem(
    'dreamChildren',
    JSON.stringify(children)
  );

  // 最初の子供を選択（いなければデフォルト）
  childId = children[0]?.id || 'default-child';
  childName = children[0]?.name || 'こども';

  localStorage.setItem('dreamSelectedChildId', childId);
  localStorage.setItem('dreamSelectedChildName', childName);

  console.log('Joined family: ' + familyId);

  alert(
    familyName + 'の' + bankName + 'に参加しました！'
  );

  codeInput.value = '';

  await initializeAppData();

  showScreen('home-screen');

}

// ============================================
// 最初の子供通帳を作成（初回セットアップ用）
// ============================================

async function createFirstChild(){

  const nameInput =
    document.getElementById('first-child-name-input');

  const animalSelect =
    document.getElementById('first-child-animal');

  const name =
    nameInput.value.trim();

  if(name === ''){
    alert('名前を入力してください');
    return;
  }

  const animal =
    animalSelect ? animalSelect.value : 'うさぎ';

  const newChildId =
    'child_' + Date.now();

  const children =
    JSON.parse(localStorage.getItem('dreamChildren') || '[]');

  children.push({
    id: newChildId,
    name: name,
    animal: animal
  });

  localStorage.setItem(
    'dreamChildren',
    JSON.stringify(children)
  );

  childId = newChildId;
  childName = name;

  localStorage.setItem('dreamSelectedChildId', childId);
  localStorage.setItem('dreamSelectedChildName', childName);

  await saveChildListToFirestore();

  nameInput.value = '';

  await initializeAppData();

  showScreen('home-screen');

}

// ============================================
// ログアウト（別の家族に切り替えたい時用）
// ============================================

function leaveFamily(){

  const ok = confirm(
    'この端末から家族銀行との接続を解除しますか？\n' +
    '（データは消えません。招待コードで再参加できます）'
  );

  if(!ok){
    return;
  }

  if(unsubscribeRealtime){
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }

  localStorage.removeItem('dreamFamilyId');
  localStorage.removeItem('dreamFamilyName');
  localStorage.removeItem('dreamBankName');
  localStorage.removeItem('dreamInviteCode');
  localStorage.removeItem('dreamParentPin');
  localStorage.removeItem('dreamSelectedChildId');
  localStorage.removeItem('dreamSelectedChildName');
  localStorage.removeItem('dreamChildren');

  familyId = null;

  showScreen('privacy-screen');

}

// ============================================
// 設定画面の家族情報表示を更新
// ============================================

function updateFamilyInfoDisplay(){

  const familyNameText =
    document.getElementById('setting-family-name');

  const bankNameText =
    document.getElementById('setting-bank-name');

  const inviteCodeText =
    document.getElementById('setting-invite-code');

  if(familyNameText){
    familyNameText.textContent =
      '家族名：' + (familyName || '未設定');
  }

  if(bankNameText){
    bankNameText.textContent =
      '銀行名：' + (bankName || '未設定');
  }

  if(inviteCodeText){
    inviteCodeText.textContent =
      inviteCode || '------';
  }

}

function copyInviteCode(){

  if(!inviteCode){
    alert('招待コードがありません');
    return;
  }

  if(navigator.clipboard){

    navigator.clipboard.writeText(inviteCode);

    alert('招待コードをコピーしました：' + inviteCode);

  }else{

    alert('招待コード：' + inviteCode);

  }

}

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

  // 家族未参加の場合は初期化しない
  if(!familyId){
    console.log('No family yet. Waiting for setup...');
    return;
  }

  await loadDataFromFirestore();

  updateGoal();

  changeInputMode();

  listenRealtimeData();

  await loadChildListFromFirestore();

  listenChildListRealtime();

  renderChildList();

  await loadMissionListFromFirestore();

  listenMissionListRealtime();

  renderMissionList();

  updateFamilyInfoDisplay();

  updatePinStatusDisplay();

}

function startApp(){

  if(familyId){

    // 参加済み → ホーム画面へ
    initializeAppData();
    showScreen('home-screen');

  }else{

    // 未参加 → ようこそ画面のまま
    showScreen('privacy-screen');

  }

}

if(window.db && window.doc){

  startApp();

}else{

  window.addEventListener(
    'firebase-ready',
    startApp
  );

}

async function saveDataToFirestore(){

  if(!familyId){
    return;
  }

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

  const modeSelect =
    document.getElementById('input-mode');

  const mode = modeSelect.value;

  // 親モードへの切替はPINで保護
  // （保存済みモードの復元時 dreamInputMode が normal の場合は確認しない）
  const savedMode =
    localStorage.getItem('dreamInputMode');

  if(
    mode === 'normal' &&
    savedMode !== 'normal' &&
    parentPin
  ){

    if(!verifyParentPin()){

      // 認証失敗 → 子供モードに戻す
      modeSelect.value = 'kana';

      return;

    }

  }

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

  if(!familyId){
    return;
  }

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

  if(!familyId){
    return;
  }

  if(unsubscribeRealtime){
    unsubscribeRealtime();
  }

  const docRef = window.doc(
    window.db,
    'families',
    familyId,
    'children',
    childId
  );

  unsubscribeRealtime = window.onSnapshot(docRef, function(docSnap){

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

      document.getElementById('transaction-list').innerHTML =
        data.transactionsHtml || '';

      document.getElementById('approval-list').innerHTML =
        data.approvalsHtml || '';

      updateGoal();

      console.log('Realtime updated!');

    }else{

      balance = 0;

      document.getElementById('balance').textContent =
        '0 Dream円';

      const homeBalance =
        document.getElementById('home-balance');

      if(homeBalance){
        homeBalance.textContent = '0 Dream円';
      }

      document.getElementById('transaction-list').innerHTML = '';
      document.getElementById('approval-list').innerHTML = '';

      updateGoal();

      console.log('Realtime empty child!');

    }

  });

}

function addChildAccount(){

  const input =
    document.getElementById('child-name-input');

  const name =
    input.value.trim();

  if(name === ''){
    alert('こどもの名前を入力してください');
    return;
  }

  const newChildId =
    'child_' + Date.now();

  const children =
    JSON.parse(localStorage.getItem('dreamChildren') || '[]');

  children.push({
    id: newChildId,
    name: name
  });

  localStorage.setItem(
    'dreamChildren',
    JSON.stringify(children)
  );

  input.value = '';

  renderChildList();
  saveChildListToFirestore();

}

function renderChildList(){

  const list =
    document.getElementById('child-list');

  if(!list){
    return;
  }

  const children =
    JSON.parse(localStorage.getItem('dreamChildren') || '[]');

  list.innerHTML = '';

  children.forEach(child => {

    const item =
      document.createElement('div');

    item.classList.add('child-item');

    if(child.id === childId){
      item.classList.add('active-child');
    }

    item.innerHTML = `
      <span>${child.name}</span>

      <div>
        <button onclick="switchChildAccount('${child.id}', '${child.name}')">
          切替
        </button>

        <button onclick="editChildAccount('${child.id}')">
          修正
        </button>

        <button onclick="deleteChildAccount('${child.id}')">
          削除
        </button>
      </div>
    `;

    list.appendChild(item);

  });

}

async function switchChildAccount(id, name){

  childId = id;
  childName = name;

  localStorage.setItem(
    'dreamSelectedChildId',
    childId
  );

  localStorage.setItem(
    'dreamSelectedChildName',
    childName
  );

  document.getElementById('transaction-list').innerHTML =
    '';

  document.getElementById('approval-list').innerHTML =
    '';

  balance = 0;

  document.getElementById('balance').textContent =
    '0 Dream円';

  const homeBalance =
    document.getElementById('home-balance');

  if(homeBalance){

    homeBalance.textContent =
      '0 Dream円';

  }

  await loadDataFromFirestore();

updateGoal();

listenRealtimeData();

renderChildList();

  alert(name + 'の通帳に切り替えました');

}

async function saveChildListToFirestore(){

  if(!familyId){
    return;
  }

  const children =
    JSON.parse(localStorage.getItem('dreamChildren') || '[]');

  await window.setDoc(
    window.doc(window.db, 'families', familyId),
    {
      familyName: familyName,
      bankName: bankName,
      inviteCode: inviteCode,
      children: children,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  console.log('Child list saved!');
}

async function loadChildListFromFirestore(){

  if(!familyId){
    return;
  }

  const docRef =
    window.doc(window.db, 'families', familyId);

  const docSnap =
    await window.getDoc(docRef);

  if(docSnap.exists()){

    const data = docSnap.data();

    // 家族情報も最新化
    if(data.familyName){
      familyName = data.familyName;
      localStorage.setItem('dreamFamilyName', familyName);
    }

    if(data.bankName){
      bankName = data.bankName;
      localStorage.setItem('dreamBankName', bankName);
    }

    if(data.inviteCode){
      inviteCode = data.inviteCode;
      localStorage.setItem('dreamInviteCode', inviteCode);
    }

    if(data.parentPin){
      parentPin = data.parentPin;
      localStorage.setItem('dreamParentPin', parentPin);
    }

    updateFamilyInfoDisplay();
    updatePinStatusDisplay();

    if(data.children){

      localStorage.setItem(
        'dreamChildren',
        JSON.stringify(data.children)
      );

      renderChildList();

      console.log('Child list loaded!');

    }

  }

}

function editChildAccount(id){

  const children =
    JSON.parse(localStorage.getItem('dreamChildren') || '[]');

  const child =
    children.find(child => child.id === id);

  if(!child){
    return;
  }

  const newName =
    prompt('新しい名前を入力してください', child.name);

  if(!newName || newName.trim() === ''){
    return;
  }

  child.name = newName.trim();

  localStorage.setItem(
    'dreamChildren',
    JSON.stringify(children)
  );

  if(childId === id){
    childName = child.name;

    localStorage.setItem(
      'dreamSelectedChildName',
      childName
    );
  }

  renderChildList();

  saveChildListToFirestore();

  alert('名前を修正しました');

}

function deleteChildAccount(id){

  const children =
    JSON.parse(localStorage.getItem('dreamChildren') || '[]');

  const child =
    children.find(child => child.id === id);

  if(!child){
    return;
  }

  const ok =
    confirm(child.name + 'の通帳を削除しますか？');

  if(!ok){
    return;
  }

  const filteredChildren =
    children.filter(child => child.id !== id);

  localStorage.setItem(
    'dreamChildren',
    JSON.stringify(filteredChildren)
  );

  if(childId === id){

    childId =
      filteredChildren[0]?.id || 'default-child';

    childName =
      filteredChildren[0]?.name || 'こども';

    localStorage.setItem(
      'dreamSelectedChildId',
      childId
    );

    localStorage.setItem(
      'dreamSelectedChildName',
      childName
    );

    document.getElementById('transaction-list').innerHTML = '';
    document.getElementById('approval-list').innerHTML = '';

    balance = 0;

    document.getElementById('balance').textContent =
      '0 Dream円';

    const homeBalance =
      document.getElementById('home-balance');

    if(homeBalance){
      homeBalance.textContent = '0 Dream円';
    }

    loadDataFromFirestore();
    listenRealtimeData();
    updateGoal();

  }

  renderChildList();

  saveChildListToFirestore();

  alert('通帳を削除しました');

}

function listenChildListRealtime(){

  if(!familyId){
    return;
  }

  const docRef =
    window.doc(window.db, 'families', familyId);

  window.onSnapshot(docRef, function(docSnap){

    if(docSnap.exists()){

      const data = docSnap.data();

      if(data.parentPin !== undefined){
        parentPin = data.parentPin || '';
        localStorage.setItem('dreamParentPin', parentPin);
        updatePinStatusDisplay();
      }

      if(data.children){

        localStorage.setItem(
          'dreamChildren',
          JSON.stringify(data.children)
        );

        renderChildList();

        console.log('Child list realtime updated!');

      }

    }

  });

}

// ============================================
// 親用PINコード（4桁の暗証番号）
// ============================================

let parentPin =
  localStorage.getItem('dreamParentPin') || '';

function updatePinStatusDisplay(){

  const status =
    document.getElementById('pin-status');

  if(!status){
    return;
  }

  status.textContent =
    parentPin ? '設定済み ✅' : '未設定';

}

async function setParentPin(){

  // すでに設定済みなら、変更前に現在のPINを確認
  if(parentPin){

    const current =
      prompt('現在の暗証番号（4桁）を入力してください');

    if(current === null){
      return;
    }

    if(current !== parentPin){
      alert('暗証番号が違います');
      return;
    }

  }

  const newPin =
    prompt('新しい暗証番号（4桁の数字）を入力してください');

  if(newPin === null){
    return;
  }

  if(!/^[0-9]{4}$/.test(newPin)){
    alert('4桁の数字で入力してください（例：1234）');
    return;
  }

  const confirmPin =
    prompt('確認のため、もう一度入力してください');

  if(confirmPin !== newPin){
    alert('暗証番号が一致しません。最初からやり直してください');
    return;
  }

  parentPin = newPin;

  localStorage.setItem('dreamParentPin', parentPin);

  // 家族全体で共有（他の端末でも同じPINが有効になる）
  if(familyId){

    await window.setDoc(
      window.doc(window.db, 'families', familyId),
      {
        parentPin: parentPin,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

  }

  updatePinStatusDisplay();

  alert('暗証番号を設定しました');

}

function verifyParentPin(){

  // PIN未設定なら通す（設定を促す）
  if(!parentPin){
    return true;
  }

  const input =
    prompt('暗証番号（4桁）を入力してください');

  if(input === null){
    return false;
  }

  if(input !== parentPin){
    alert('暗証番号が違います');
    return false;
  }

  return true;

}

// ============================================
// 管理者画面（親モード専用・PINガード付き）
// ============================================

function openAdminScreen(){

  if(!verifyParentPin()){
    return;
  }

  if(!parentPin){
    alert(
      '管理者画面を開きます。\n\n' +
      'ヒント：設定画面で暗証番号（PIN)を設定すると、\n' +
      '子供が勝手に開けないように保護できます'
    );
  }

  renderAdminMissionList();

  showScreen('admin-screen');

}

function renderAdminMissionList(){

  const list =
    document.getElementById('admin-mission-list');

  if(!list){
    return;
  }

  const missions =
    JSON.parse(localStorage.getItem('dreamMissions') || '[]');

  list.innerHTML = '';

  if(missions.length === 0){
    list.innerHTML =
      '<p>まだおしごとがありません。<br>上のフォームから追加してください</p>';
    return;
  }

  missions.forEach(mission => {

    const item =
      document.createElement('div');

    item.classList.add('child-item');

    item.innerHTML = `
      <span>${mission.name}（${mission.reward} Dream円）</span>

      <div>
        <button onclick="editMissionName('${mission.id}')">
          名前
        </button>

        <button onclick="editMissionReward('${mission.id}')">
          報酬
        </button>

        <button onclick="deleteMission('${mission.id}')">
          削除
        </button>
      </div>
    `;

    list.appendChild(item);

  });

}

function editMissionName(id){

  const missions =
    JSON.parse(localStorage.getItem('dreamMissions') || '[]');

  const mission =
    missions.find(m => m.id === id);

  if(!mission){
    return;
  }

  const newName =
    prompt('新しいおしごと名を入力してください', mission.name);

  if(!newName || newName.trim() === ''){
    return;
  }

  mission.name = newName.trim();

  localStorage.setItem(
    'dreamMissions',
    JSON.stringify(missions)
  );

  renderMissionList();
  renderAdminMissionList();
  saveMissionListToFirestore();

  alert('おしごと名を変更しました');

}

function editMissionReward(id){

  const missions =
    JSON.parse(localStorage.getItem('dreamMissions') || '[]');

  const mission =
    missions.find(m => m.id === id);

  if(!mission){
    return;
  }

  const newReward =
    prompt('新しい報酬を入力してください（Dream円）', mission.reward);

  const reward = Number(newReward);

  if(!newReward || isNaN(reward) || reward <= 0){
    alert('1以上の数字を入力してください');
    return;
  }

  mission.reward = reward;

  localStorage.setItem(
    'dreamMissions',
    JSON.stringify(missions)
  );

  renderMissionList();
  renderAdminMissionList();
  saveMissionListToFirestore();

  alert('報酬を ' + reward + ' Dream円 に変更しました');

}

function deleteMission(id){

  const missions =
    JSON.parse(localStorage.getItem('dreamMissions') || '[]');

  const mission =
    missions.find(m => m.id === id);

  if(!mission){
    return;
  }

  const ok =
    confirm('「' + mission.name + '」を削除しますか？');

  if(!ok){
    return;
  }

  const filtered =
    missions.filter(m => m.id !== id);

  localStorage.setItem(
    'dreamMissions',
    JSON.stringify(filtered)
  );

  renderMissionList();
  renderAdminMissionList();
  saveMissionListToFirestore();

  alert('おしごとを削除しました');

}

function addMission(){

  const nameInput =
    document.getElementById('mission-name-input');

  const rewardInput =
    document.getElementById('mission-reward-input');

  const name =
    nameInput.value.trim();

  const reward =
    Number(rewardInput.value);

  if(name === '' || reward <= 0){
    alert('おしごと名と報酬を入力してください');
    return;
  }

  const missions =
    JSON.parse(localStorage.getItem('dreamMissions') || '[]');

  missions.push({
    id: 'mission_' + Date.now(),
    name: name,
    reward: reward
  });

  localStorage.setItem(
    'dreamMissions',
    JSON.stringify(missions)
  );

  nameInput.value = '';
  rewardInput.value = '';

  renderMissionList();
  renderAdminMissionList();
  saveMissionListToFirestore();

}

function renderMissionList(){

  const list =
    document.getElementById('mission-list');

  if(!list){
    return;
  }

  const missions =
    JSON.parse(localStorage.getItem('dreamMissions') || '[]');

  list.innerHTML = '';

  missions.forEach(mission => {

    const item =
      document.createElement('div');

    item.classList.add('mission-card');

    item.innerHTML = `
      <div class="mission-icon">⭐</div>

      <div class="mission-info">
        <h2>${mission.name}</h2>
        <p>報酬：${mission.reward} Dream円</p>
        <p>難易度：⭐</p>
      </div>

      <button onclick="completeMission(this)">
        完了した
      </button>
    `;

    list.appendChild(item);

  });

}

async function saveMissionListToFirestore(){

  if(!familyId){
    return;
  }

  const missions =
    JSON.parse(localStorage.getItem('dreamMissions') || '[]');

  await window.setDoc(
    window.doc(window.db, 'families', familyId, 'missionSettings', 'missions'),
    {
      missions: missions,
      updatedAt: new Date().toISOString()
    }
  );

  console.log('Mission list saved!');

}

async function loadMissionListFromFirestore(){

  if(!familyId){
    return;
  }

  const docRef =
    window.doc(window.db, 'families', familyId, 'missionSettings', 'missions');

  const docSnap =
    await window.getDoc(docRef);

  if(docSnap.exists()){

    const data = docSnap.data();

    if(data.missions){

      localStorage.setItem(
        'dreamMissions',
        JSON.stringify(data.missions)
      );

      renderMissionList();

      console.log('Mission list loaded!');

    }

  }

}

function listenMissionListRealtime(){

  if(!familyId){
    return;
  }

  const docRef =
    window.doc(window.db, 'families', familyId, 'missionSettings', 'missions');

  window.onSnapshot(docRef, function(docSnap){

    if(docSnap.exists()){

      const data = docSnap.data();

      if(data.missions){

        localStorage.setItem(
          'dreamMissions',
          JSON.stringify(data.missions)
        );

        renderMissionList();
        renderAdminMissionList();

        console.log('Mission list realtime updated!');

      }

    }

  });

}
