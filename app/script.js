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

  // QR画面から離れたらカメラを止める（電池とプライバシーのため）
  if(screenId !== 'qr-screen' && typeof qrScanning !== 'undefined' && qrScanning){
    stopQrScan();
  }

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

  loadExchangeRates();

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

  // 報酬額にいちばん近い紙幣のごほうび動画を提案
  const video =
    getBillVideoForAmount(reward);

  const watchVideo = confirm(
    '承認しました！🎉\n\n' +
    'ごほうびに ' + video.label + ' のとくべつ動画をみる？'
  );

  if(watchVideo){
    window.open(video.url, '_blank');
  }

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

  // 子供モードに戻したら認証をリセット
  // （次に親の操作をするときは再度PINが必要）
  if(mode === 'kana'){
    pinVerified = false;
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

// 一度PINを入力したら覚えておくフラグ
// （子供モードに戻すか、ページを閉じるとリセット）
let pinVerified = false;

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
  if(parentPin && !pinVerified){

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

  // すでに認証済みなら再入力不要
  if(pinVerified){
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

  // 認証成功 → 覚えておく
  pinVerified = true;

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

// ============================================
// 為替（実相場連動）
// ============================================

// 取得失敗時のフォールバック値
let exchangeRates = {
  USD: 155,
  EUR: 166,
  GBP: 195
};

let exchangeLoaded = false;

async function loadExchangeRates(){

  const updatedText =
    document.getElementById('exchange-updated');

  if(updatedText){
    updatedText.textContent = 'レートを読み込み中...';
  }

  // ① メイン：Frankfurter API（欧州中央銀行のレート）
  try{

    const response = await fetch(
      'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=USD,EUR,GBP'
    );

    if(!response.ok){
      throw new Error('Frankfurter API error: ' + response.status);
    }

    const data = await response.json();

    // JPY基準のレートを「1外貨＝何円」に変換
    exchangeRates.USD = 1 / data.rates.USD;
    exchangeRates.EUR = 1 / data.rates.EUR;
    exchangeRates.GBP = 1 / data.rates.GBP;

    exchangeLoaded = true;

    renderExchangeRates(data.date);

    console.log('Exchange rates loaded! (Frankfurter)');

    return;

  }catch(error){

    console.log('Frankfurter failed. Trying backup...', error);

  }

  // ② 予備：open.er-api.com（無料・キー不要）
  try{

    const response = await fetch(
      'https://open.er-api.com/v6/latest/JPY'
    );

    if(!response.ok){
      throw new Error('Backup API error: ' + response.status);
    }

    const data = await response.json();

    if(data.result !== 'success'){
      throw new Error('Backup API returned: ' + data.result);
    }

    exchangeRates.USD = 1 / data.rates.USD;
    exchangeRates.EUR = 1 / data.rates.EUR;
    exchangeRates.GBP = 1 / data.rates.GBP;

    exchangeLoaded = true;

    const date =
      data.time_last_update_utc
        ? data.time_last_update_utc.slice(0, 16)
        : '';

    renderExchangeRates(date);

    console.log('Exchange rates loaded! (Backup API)');

    return;

  }catch(error){

    console.log('Backup API also failed. Using fallback.', error);

    renderExchangeRates(null);

  }

}

function renderExchangeRates(date){

  const list =
    document.getElementById('exchange-list');

  const updatedText =
    document.getElementById('exchange-updated');

  if(!list){
    return;
  }

  list.innerHTML = `
    <p>🇺🇸 USD 米ドル：${exchangeRates.USD.toFixed(2)} 円</p>
    <p>🇪🇺 EUR ユーロ：${exchangeRates.EUR.toFixed(2)} 円</p>
    <p>🇬🇧 GBP ポンド：${exchangeRates.GBP.toFixed(2)} 円</p>
    <p>🇯🇵 JPY 日本円：1円</p>
  `;

  if(updatedText){

    if(exchangeLoaded && date){
      updatedText.textContent =
        '📅 ' + date + ' のレート（1 Dream円 = 1円）';
    }else{
      updatedText.textContent =
        '⚠️ さいしんのレートが取れなかったので、めやすの値を表示しています';
    }

  }

}

function calculateExchange(){

  const amountInput =
    document.getElementById('exchange-amount');

  const currencySelect =
    document.getElementById('exchange-currency');

  const resultText =
    document.getElementById('exchange-result');

  const amount =
    Number(amountInput.value);

  if(!amount || amount <= 0){
    alert('Dream円を入力してください');
    return;
  }

  const currency = currencySelect.value;

  const rate = exchangeRates[currency];

  const converted = amount / rate;

  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£'
  };

  resultText.textContent =
    symbols[currency] + ' ' + converted.toFixed(2);

}

// ============================================
// QR紙幣連携
// ============================================

let qrStream = null;
let qrScanning = false;
let qrLastScanTime = 0;

async function startQrScan(){

  const video =
    document.getElementById('qr-video');

  const status =
    document.getElementById('qr-status');

  const startBtn =
    document.getElementById('qr-start-btn');

  const stopBtn =
    document.getElementById('qr-stop-btn');

  if(!navigator.mediaDevices){
    status.textContent =
      'このブラウザはカメラに対応していません';
    return;
  }

  try{

    qrStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = qrStream;
    video.style.display = 'block';

    await video.play();

    qrScanning = true;

    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';

    status.textContent =
      'QRコードをカメラにかざしてね';

    scanQrLoop();

  }catch(error){

    console.log('Camera error:', error);

    status.textContent =
      'カメラをきどうできませんでした。\nカメラの使用を「許可」してください';

  }

}

function stopQrScan(){

  qrScanning = false;

  const video =
    document.getElementById('qr-video');

  const startBtn =
    document.getElementById('qr-start-btn');

  const stopBtn =
    document.getElementById('qr-stop-btn');

  const status =
    document.getElementById('qr-status');

  if(qrStream){

    qrStream.getTracks().forEach(track => track.stop());

    qrStream = null;

  }

  if(video){
    video.style.display = 'none';
    video.srcObject = null;
  }

  if(startBtn){
    startBtn.style.display = 'block';
  }

  if(stopBtn){
    stopBtn.style.display = 'none';
  }

  if(status){
    status.textContent =
      '「スキャンかいし」をおしてカメラをきどうしてね';
  }

}

let qrBarcodeDetector = null;

// ZXingの低レベルAPIでcanvasを解読（ECI対応・確実に動く方式）
function decodeCanvasWithZXing(canvas){

  if(typeof ZXing === 'undefined'){
    return null;
  }

  try{

    const luminance =
      new ZXing.HTMLCanvasElementLuminanceSource(canvas);

    const binaryBitmap =
      new ZXing.BinaryBitmap(
        new ZXing.HybridBinarizer(luminance)
      );

    const hints = new Map();

    hints.set(
      ZXing.DecodeHintType.POSSIBLE_FORMATS,
      [ZXing.BarcodeFormat.QR_CODE]
    );

    hints.set(
      ZXing.DecodeHintType.TRY_HARDER,
      true
    );

    const reader =
      new ZXing.MultiFormatReader();

    reader.setHints(hints);

    const result =
      reader.decode(binaryBitmap);

    return result ? result.getText() : null;

  }catch(e){

    // NotFoundException は「このフレームに無い」だけなので正常
    return null;

  }

}

async function scanQrLoop(){

  if(!qrScanning){
    return;
  }

  const video =
    document.getElementById('qr-video');

  const canvas =
    document.getElementById('qr-canvas');

  if(video.readyState === video.HAVE_ENOUGH_DATA){

    let result = null;

    // ① ネイティブのBarcodeDetector（標準カメラと同じエンジン・ECI対応）
    if('BarcodeDetector' in window){

      try{

        if(!qrBarcodeDetector){
          qrBarcodeDetector =
            new BarcodeDetector({ formats: ['qr_code'] });
        }

        const codes =
          await qrBarcodeDetector.detect(video);

        if(codes.length > 0){
          result = codes[0].rawValue;
        }

      }catch(e){
        // 非対応・エラー時は次の方式へ
      }

    }

    // ② ZXing（ECI対応ライブラリ・低レベルAPI）
    if(!result){

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      result = decodeCanvasWithZXing(canvas);

    }

    // ③ jsQR（最終フォールバック）
    if(!result && typeof jsQR !== 'undefined'){

      const ctx = canvas.getContext('2d');

      const imageData =
        ctx.getImageData(0, 0, canvas.width, canvas.height);

      const code = jsQR(
        imageData.data,
        imageData.width,
        imageData.height
      );

      if(code){
        result = code.data;
      }

    }

    // 連続読み取り防止（3秒クールダウン）
    if(result && Date.now() - qrLastScanTime > 3000){

      qrLastScanTime = Date.now();

      handleQrResult(result);

    }

  }

  requestAnimationFrame(scanQrLoop);

}

// 写真撮影でのQR読み取り（カメラアプリのオートフォーカスが使える確実な方式）
function scanQrFromPhoto(input){

  const status =
    document.getElementById('qr-status');

  const file = input.files[0];

  if(!file){
    return;
  }

  status.textContent =
    'しゃしんをかいせき中...';

  const img = new Image();

  img.onload = function(){

    const canvas =
      document.getElementById('qr-canvas');

    // 大きすぎる写真は縮小しながら複数サイズで試す
    const sizes = [1600, 1000, 2400, 600];

    let result = null;

    for(const maxSize of sizes){

      const scale =
        Math.min(1, maxSize / Math.max(img.width, img.height));

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // ZXing → jsQR の順に試す
      result = decodeCanvasWithZXing(canvas);

      if(!result && typeof jsQR !== 'undefined'){

        const imageData =
          ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(
          imageData.data,
          imageData.width,
          imageData.height
        );

        if(code){
          result = code.data;
        }

      }

      if(result){
        break;
      }

    }

    if(result){

      handleQrResult(result);

    }else{

      status.textContent =
        'しゃしんからQRをみつけられませんでした。\nQRが大きくはっきりうつるように、もういちどさつえいしてね';

    }

    // 同じ写真をもう一度選べるようにリセット
    input.value = '';

  };

  img.src = URL.createObjectURL(file);

}

// QRの中身から金額を判別（複数形式に対応）

// 印刷済みDream紙幣のQRコード対応表（動画URL → 金額）
// ※最新の紙幣シート（2列5行版）のQR解読結果に基づく
const DREAM_BILL_QR = {
  'bgoU1s': { amount: 1,      label: '1円札' },
  'bgoU5H': { amount: 5,      label: '5円札' },
  'bgoU5l': { amount: 10,     label: '10円札' },
  'bgoU6D': { amount: 50,     label: '50円札' },
  'bgoU6e': { amount: 100,    label: '100円札' },
  'bgoU74': { amount: 500,    label: '500円札' },
  'bgoU7b': { amount: 1000,   label: '1000円札' },
  'bgoU8R': { amount: 5000,   label: '5000円札' },
  'bgoU7v': { amount: 5000,   label: '5000円札（旧）' },
  'bgoU8x': { amount: 10000,  label: '10000円札' },
  'bgoTxS': { amount: 100000, label: 'ひみつの壱拾万円札🐉✨' }
};

// Dream紙幣のQRかチェック（qrco.de の短縮コードで判別）
function parseDreamBill(text){

  const match =
    text.match(/qrco\.de\/([A-Za-z0-9]+)/);

  if(!match){
    return null;
  }

  return DREAM_BILL_QR[match[1]] || null;

}

// 金額にいちばん近い紙幣の動画を探す
// （ひみつの紙幣は除外して通常の紙幣から選ぶ）
function getBillVideoForAmount(amount){

  const bills =
    Object.entries(DREAM_BILL_QR)
      .filter(([code, bill]) => !bill.label.includes('ひみつ'))
      .map(([code, bill]) => ({
        code: code,
        amount: bill.amount,
        label: bill.label
      }));

  let closest = bills[0];

  let minDiff =
    Math.abs(amount - closest.amount);

  bills.forEach(bill => {

    const diff =
      Math.abs(amount - bill.amount);

    if(diff < minDiff){
      minDiff = diff;
      closest = bill;
    }

  });

  return {
    url: 'https://qrco.de/' + closest.code,
    label: closest.label,
    amount: closest.amount
  };

}

function parseQrAmount(text){

  if(!text){
    return null;
  }

  const trimmed = text.trim();

  // 形式①：数字だけ（例：100）
  if(/^[0-9]+$/.test(trimmed)){
    return Number(trimmed);
  }

  // 形式②：DREAM:100 / dream-100 / Dream紙幣100 など
  const dreamMatch =
    trimmed.match(/dream[^0-9]*([0-9]+)/i);

  if(dreamMatch){
    return Number(dreamMatch[1]);
  }

  // 形式③：JSON（例：{"amount":100}）
  try{

    const json = JSON.parse(trimmed);

    if(json.amount){
      return Number(json.amount);
    }

  }catch(e){
    // JSONでなければ次へ
  }

  // 形式④：URLの amount パラメータ（例：?amount=100）
  const urlMatch =
    trimmed.match(/[?&]amount=([0-9]+)/);

  if(urlMatch){
    return Number(urlMatch[1]);
  }

  return null;

}

function handleQrResult(text){

  const status =
    document.getElementById('qr-status');

  // ① まず印刷済みDream紙幣かチェック
  const bill = parseDreamBill(text);

  if(bill){

    const ok = confirm(
      '💴 ' + bill.label + '（' + bill.amount + ' Dream円）をよみとりました！\n承認待ちに追加しますか？'
    );

    // ダイアログ中に経過した時間でも再検出しないようリセット
    qrLastScanTime = Date.now();

    if(!ok){
      status.textContent =
        'キャンセルしました。べつのQRをよみとれます';
      return;
    }

    queueQrDeposit(bill.label, bill.amount);

    // 同じ紙幣を再検出しないようスキャンを自動停止
    stopQrScan();

    status.textContent =
      '✅ ' + bill.label + ' を承認待ちに追加しました！\n親に承認してもらうと入金されます。\nつづけてよみとるには「スキャンかいし」をおしてね';

    return;

  }

  // ② 汎用形式（数字 / DREAM:100 / JSON / amount=）
  const amount = parseQrAmount(text);

  if(!amount || amount <= 0){

    status.textContent =
      'このQRコードはDream紙幣ではないみたい…\n（よみとった内容：' + text.slice(0, 30) + '）';

    return;

  }

  const ok = confirm(
    '💴 ' + amount + ' Dream円の紙幣をよみとりました！\n承認待ちに追加しますか？'
  );

  qrLastScanTime = Date.now();

  if(!ok){
    status.textContent =
      'キャンセルしました。べつのQRをよみとれます';
    return;
  }

  queueQrDeposit('Dream紙幣', amount);

  stopQrScan();

  status.textContent =
    '✅ ' + amount + ' Dream円を承認待ちに追加しました！\n親に承認してもらうと入金されます。\nつづけてよみとるには「スキャンかいし」をおしてね';

}

// QRスキャンを承認待ちに登録（親の承認後に入金される）
function queueQrDeposit(label, amount){

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
    <h2>💴 ${label}</h2>
    <p>${amount} Dream円</p>
    <p class="approval-date">${dateTime} QRスキャン</p>
  </div>

  <div>
    <button onclick="approveQrDeposit(this, '${label}', ${amount})">
      承認
    </button>

    <button class="sub-btn" onclick="rejectApproval(this)">
      却下
    </button>
  </div>
`;

  approvalList.prepend(item);

  saveData();

}

// 承認待ちを却下（重複スキャンなどを親が取り消せる）
function rejectApproval(button){

  const ok =
    confirm('この承認待ちを却下しますか？\n（入金されずに削除されます）');

  if(!ok){
    return;
  }

  button.closest('.approval-card').remove();

  saveData();

}

// 親がQR入金を承認 → ここで初めて残高に反映
function approveQrDeposit(button, label, amount){

  depositFromQr(amount, label);

  button.parentElement.remove();

  saveData();

  alert(label + '（' + amount + ' Dream円）を入金しました！');

}

function depositFromQr(amount, label){

  balance += amount;

  const balanceText =
    document.getElementById('balance');

  if(balanceText){
    balanceText.textContent =
      balance + ' Dream円';
  }

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
    <div>💴 ${label || 'Dream紙幣'}</div>
    <div>+${amount}円</div>
  `;

  list.prepend(item);

  updateGoal();
  saveData();

}

// 管理者画面：Dream紙幣QRの作成
function makeQrBill(){

  const amountInput =
    document.getElementById('qr-make-amount');

  const area =
    document.getElementById('qr-bill-area');

  const amount =
    Number(amountInput.value);

  if(!amount || amount <= 0){
    alert('金額を入力してください');
    return;
  }

  // アプリで読み取れる形式：DREAM:金額
  const qrText = 'DREAM:' + amount;

  // QR画像生成（api.qrserver.com：無料・キー不要）
  const qrUrl =
    'https://api.qrserver.com/v1/create-qr-code/' +
    '?size=200x200&data=' + encodeURIComponent(qrText);

  area.innerHTML = `
    <p><strong>${amount} Dream円 の紙幣QR</strong></p>
    <img src="${qrUrl}" alt="QR ${amount}" style="border-radius:12px; border:4px solid #ffc85c;">
    <p>長押し（右クリック）で画像を保存して、紙幣に印刷してください</p>
  `;

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
