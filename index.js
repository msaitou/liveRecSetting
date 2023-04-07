const ID1 = "#t1"; // データ抽出タブ
const ID3 = "#t3"; // 整形＆出力タブ
const ID4 = "#t4"; // シーズン
const ID5 = "#t5"; // 役
const ID6 = "#t6"; // 選手
const ID2 = "#t2"; // アカウントタブ

// toastクラスがついている要素にBootStrapのトーストを適用する
var toastElList = [].slice.call(document.querySelectorAll(".toast"));
var toastList = toastElList.map(function (toastEl) {
  return new bootstrap.Toast(toastEl, {
    // // オプション
    // delay: 10000,
  });
});
// ボタンをクリックしたときに実行される関数
function showErrToast(mList) {
  document.querySelector(`#liveToastErr .toast-body`).innerHTML = mList.join("<br>");
  toastList[0].show();
}
function showOkToast(mList) {
  document.querySelector(`#liveToastOk .toast-body`).innerHTML = mList.join("<br>");
  toastList[1].show();
}
function toggleDisabled(isBool) {
  document.querySelector(".loading").classList.toggle("d-none");
  document.querySelectorAll("input, select,textarea,button, a").forEach((e) => {
    e.disabled = isBool;
  });
}
function clearDispLog() {
  document.querySelector(".log>div").textContent = "";
}
// const url = "http://localhost:3333/";
// const url = "https://asia-northeast1-just-experience-353604.cloudfunctions.net/abema";
const url = "https://asia-northeast1-abema-383005.cloudfunctions.net/mongo-wrapper/m";

const reqApi = (params, query = "") => {
  return fetch(`${url}${query}`, params)
    .then((res) => res.json())
    .catch((err) => {
      console.log(err);
      console.log("err");
    });
};
// // アカウントタブ ID2------------------------------
// document.querySelector(`${ID2} button.save`).addEventListener("click", async () => {
//   let saveObjs = {};
//   let messageList = [];
//   id2FieldsList.forEach((f) => {
//     saveObjs[f] = document.querySelector(`${ID2} [name='${f}']`);
//     if (!saveObjs[f].value) {
//       saveObjs[f].focus();
//       switch (f) {
//         case id2FieldsList[0]:
//           messageList.push("アカウントを入力してください");
//           break;
//         case id2FieldsList[1]:
//           messageList.push("パスワードを入力してください");
//           break;
//       }
//     }
//   });
//   if (messageList.length) {
//     showErrToast(messageList);
//     return;
//   }
//   let data = { id: saveObjs.id.value, password: saveObjs.password.value };
//   let where = `rowid = ${document.querySelector(`${ID2} input[name='rowid']`).value}`;
//   // console.log(data, where);
//   // let res = await window.eAPI.accessDb("ACCOUNT", "update", null, { recs: data, cond: where });
//   // // console.log(res);
//   // if (res && res.err) showErrToast([res.err]);
//   // else showOkToast(["アカウント情報の更新に成功しました。"]);
// });
// // アカウントタブ ID2------------------------------
// データ抽出タブ ID1------------------------------
let id1FieldsList = ["year", "kind", "targets", "reconvert_raw", "reconvert_sche"];
document.querySelector(`${ID4} button.save`).addEventListener("click", async () => {
  let saveData = {
    host: DB_INFO.HOST,
    dbName: DB_INFO.DB_NAME,
    coll: "auth_user",
    method: "find",
    opt: {},
  };
  await reqApi({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(saveData),
  }).then((res) => {
    console.log("aaa", res);
  });
});
// データ抽出タブ ID1------------------------------
// 整形＆出力タブ ID3------------------------------
let id3FieldsList = ["game_no", "status"];
let getId3data = async () => {
  let year = document.querySelector(`${ID3} input[name="year"]`);
  if (!year.value) {
    year.focus();
    let messageList = [];
    messageList.push("年度を入力してください");
    showErrToast(messageList);
    return;
  }
  // let res = await window.eAPI.extractedData(year.value);
  // if (res && res.err) {
  //   showErrToast([res.err]);
  //   return;
  // }
  // //オブジェクトの昇順ソート
  // res.sort((a, b) => (a.game_no < b.game_no ? -1 : 1));
  // let html = "";
  // // console.log(data);
  // res.forEach((d) => {
  //   html += `<tr>`;
  //   html += `<td><input type="checkbox" class="form-checkbox" name="check" game_id="${d.game_id}"/></td>`;
  //   html += id3FieldsList.reduce((l, f) => l + `<td ${f}>${d[f]}</td>`, ``);
  //   html += `</tr>`;
  // });
  // // console.log(html);
  // document.querySelector(`${ID3} span.recnum`).textContent = res.length;
  // document.querySelector(`${ID3} span.convertnum`).textContent = res.filter((d) => d.status == "済").length;
  // document.querySelector(`${ID3} div[summary]`).classList.remove("d-none"); // 表示する
  // document.querySelector(`${ID3} tbody`).innerHTML = html;
  // document.querySelectorAll(`${ID3} table td`).forEach((el) => {
  //   el.addEventListener("click", (e) => {
  //     let checkEl = e.target.parentElement.querySelector("[name='check']");
  //     checkEl.checked = !checkEl.checked;
  //   });
  // }); // 行クリックでチェックonoff
  // document.querySelectorAll(`${ID3} [name='check']`).forEach((el) => {
  //   el.addEventListener("click", (e) => {
  //     e.stopPropagation(); // tdのイベントで変更が無くなるのでバブリングをキャンセル
  //   });
  // });
};
// document.querySelector(`${ID3} button.redisp`).addEventListener("click", getId3data);
// document.querySelector(`${ID3} #checkall`).addEventListener("change", (e) => {
//   // console.log(e.target.checked);
//   document.querySelectorAll(`${ID3} [name="check"]`).forEach((el) => {
//     el.checked = e.target.checked;
//   });
// });
// document.querySelector(`${ID3} button.output`).addEventListener("click", async () => {
//   let data = {
//     year: document.querySelector(`${ID3} [name="year"]`).value,
//     reconvert: document.querySelector(`${ID3} #reconvert`).checked,
//     targetList: {},
//   };
//   document.querySelectorAll(`${ID3} [name='check']`).forEach((el, i) => {
//     if (el.checked) {
//       // if (!data.reconvert && el.closest("tr").querySelector("[status]").textContent == "済") return;
//       let gameNo = el.closest("tr").querySelector("[game_no]").textContent;
//       let dateId = gameNo.substring(0, gameNo.length - 2);
//       if (!(dateId in data.targetList)) data.targetList[dateId] = [];
//       data.targetList[dateId].push(el.getAttribute("game_id"));
//     }
//   });
//   // toggleDisabled(true);
//   // // console.log(data);
//   // let res = await window.eAPI.convert(data);
//   // toggleDisabled(false);
//   // // console.log(res);

//   // if (res && res.err) {
//   //   showErrToast([res.err]);
//   //   return;
//   // } else showOkToast(["データの抽出が完了しました。"]);
//   // for (let [tbl, lines] of Object.entries(res)) {
//   //   if (["STATS", "RESULTS"].indexOf(tbl) === -1) continue;
//   //   //IEとその他で処理の切り分け
//   //   if (navigator.appVersion.toString().indexOf(".NET") > 0) {
//   //     //IE 10+
//   //     window.navigator.msSaveBlob(res, fileName + ".pdf");
//   //   } else {
//   //     //aタグの生成
//   //     var a = document.createElement("a");
//   //     //レスポンスからBlobオブジェクト＆URLの生成
//   //     var blobUrl = window.URL.createObjectURL(new Blob([lines], { type: "text/csv" }));
//   //     //上で生成したaタグをアペンド
//   //     document.body.appendChild(a);
//   //     a.style = "display: none";
//   //     //BlobオブジェクトURLをセット
//   //     a.href = blobUrl;
//   //     //ダウンロードさせるファイル名の生成
//   //     a.download = tbl + ".csv";
//   //     //クリックイベント発火
//   //     a.click();
//   //   }
//   // }

//   // getId3data(); // 再表示
//   // document.querySelector(`${ID3} #checkall`).checked = false; // 元に戻す
// });
// 整形＆出力タブ ID3------------------------------
// シーズンタブ ID4------------------------------
let id4FieldsList = ["year", "url_key", "kind", "start_date"];
let getId4data = async () => {
  // let data = await window.eAPI.accessDb("SEASON", "select", null, {
  //   cond: null,
  //   fields: `OID,${id4FieldsList.join(",")}`,
  // });
  // let html = "";
  // // console.log(data);
  //   //オブジェクトの降順ソート
  //   data.sort((a, b) => (a.url_key > b.url_key ? -1 : 1));
  // data.forEach((d) => {
  //   html += `<tr>`;
  //   // `<td>${d.year}</td><td>${d.url_key}</td><td>${d.kind}</td><td>${d.start_date}</td>`;
  //   html += id4FieldsList.reduce((l, f) => l + `<td>${d[f]}</td>`, ``);
  //   html += `<td><i class="btn btn-sm btn-dark me-1 py-0 fas fa-edit" rowid="${d.rowid}"></i>
  //   <i class="btn btn-sm btn-dark me-1 py-0 fas fa-trash-can" rowid="${d.rowid}"></i></td></tr>`;
  // });
  // // console.log(html);
  // document.querySelector(`${ID4} tbody`).innerHTML = html;
  // document.querySelectorAll(`${ID4} i.fa-edit`).forEach((e, i) => {
  //   e.addEventListener("click", () => {
  //     let d = data.filter((d) => d.rowid == e.getAttribute("rowid"))[0];
  //     document.querySelector(`${ID4} input[name='rowid']`).value = d.rowid;
  //     id4FieldsList.forEach((f) => {
  //       document.querySelector(`${ID4} input[name='${f}']`).value = d[f];
  //     });
  //     document.querySelector(`${ID4} .mode`).textContent = "編集";
  //     document.querySelector(`${ID4} .mode`).classList.add("text-warning");
  //   });
  // });
  // document.querySelectorAll(`${ID4} i.fa-trash-can`).forEach((e, i) => {
  //   e.addEventListener("click", async () => {
  //     // console.log("trash");
  //     let rowid = e.getAttribute("rowid");
  //     if (rowid) {
  //       where = `rowid = ${rowid}`;
  //       let res = await window.eAPI.accessDb("SEASON", "delete", null, { cond: where });
  //       // console.log(res);
  //       if (res && res.err) showErrToast([res.err]);
  //       else showOkToast(["1つのシーズン情報の削除に成功しました。"]);
  //       getId4data(); // 再表示
  //     }
  //   });
  // });
};
// document.querySelector(`${ID4} button.redisp`).addEventListener("click", getId4data);
// document.querySelector(`${ID4} a.new`).addEventListener("click", () => {
//   document.querySelector(`${ID4} input[name='rowid']`).value;
//   id4FieldsList.forEach((f) => {
//     document.querySelector(`${ID4} input[name='${f}']`).value = "";
//   });
//   document.querySelector(`${ID4} .mode`).textContent = "新規";
//   document.querySelector(`${ID4} .mode`).classList.remove("text-warning");
// });
// document.querySelector(`${ID4} button.save`).addEventListener("click", async () => {
//   let saveObjs = {};
//   let messageList = [];
//   id4FieldsList.forEach((f) => {
//     saveObjs[f] = document.querySelector(`${ID4} input[name='${f}']`);
//     if (!saveObjs[f].value) {
//       if (messageList.length === 0) saveObjs[f].focus();
//       switch (f) {
//         case id4FieldsList[0]:
//           messageList.push("年度を入力してください");
//           break;
//         case id4FieldsList[1]:
//           messageList.push("シースンキーを入力してください");
//           break;
//         case id4FieldsList[2]:
//           messageList.push("シーズン種別を入力してください");
//           break;
//         case id4FieldsList[3]:
//           messageList.push("シーズン開始日を入力してください");
//           break;
//       }
//     }
//   });
//   if (messageList.length) {
//     showErrToast(messageList);
//     return;
//   }

//   let saveData = [[]];
//   id4FieldsList.forEach((f) => {
//     saveData[0].push(saveObjs[f].value);
//   });
//   let where = "";
//   let method = "insert";
//   let rowid = document.querySelector(`${ID4} input[name='rowid']`).value;
//   if (rowid) {
//     method = "update";
//     where = `rowid = ${rowid}`;
//     let tmp = {};
//     id4FieldsList.forEach((f, i) => {
//       tmp[f] = saveData[0][i];
//     });
//     saveData = tmp;
//   }
//   // let res = await window.eAPI.accessDb("SEASON", method, null, { recs: saveData, cond: where });
//   // // console.log(res);
//   // if (res && res.err) showErrToast([res.err]);
//   // else showOkToast(["シーズン情報の更新に成功しました。"]);
//   // document.querySelector(`${ID4} a.new`).click(); // 初期化
//   // getId4data(); // 再表示
// });
// シーズンタブ ID4------------------------------
// 役タブ ID5------------------------------
let id5FieldsList = ["official", "haruzo"];
let getId5data = async () => {
  // let data = await window.eAPI.accessDb("YAKU", "select", null, {
  //   cond: null,
  //   fields: `OID,${id5FieldsList.join(",")}`,
  // });
  // let html = "";
  // // console.log(data);
  // data.forEach((d) => {
  //   html += `<tr>`;
  //   html += id5FieldsList.reduce((l, f) => l + `<td>${d[f]}</td>`, ``);
  //   html += `<td><i class="btn btn-sm btn-dark me-1 py-0 fas fa-edit" rowid="${d.rowid}"></i>
  //   <i class="btn btn-sm btn-dark me-1 py-0 fas fa-trash-can" rowid="${d.rowid}"></i></td></tr>`;
  // });
  // document.querySelector(`${ID5} tbody`).innerHTML = html;
  // document.querySelectorAll(`${ID5} i.fa-edit`).forEach((e, i) => {
  //   e.addEventListener("click", () => {
  //     let d = data.filter((d) => d.rowid == e.getAttribute("rowid"))[0];
  //     document.querySelector(`${ID5} input[name='rowid']`).value = d.rowid;
  //     id5FieldsList.forEach((f) => {
  //       document.querySelector(`${ID5} input[name='${f}']`).value = d[f];
  //     });
  //     document.querySelector(`${ID5} .mode`).textContent = "編集";
  //     document.querySelector(`${ID5} .mode`).classList.add("text-warning");
  //   });
  // });
  // document.querySelectorAll(`${ID5} i.fa-trash-can`).forEach((e, i) => {
  //   e.addEventListener("click", async () => {
  //     // console.log("trash");
  //     let rowid = e.getAttribute("rowid");
  //     if (rowid) {
  //       where = `rowid = ${rowid}`;
  //       let res = await window.eAPI.accessDb("YAKU", "delete", null, { cond: where });
  //       // console.log(res);
  //       if (res && res.err) showErrToast([res.err]);
  //       else showOkToast(["1つの役の削除に成功しました。"]);
  //       getId5data(); // 再表示
  //     }
  //   });
  // });
};
// document.querySelector(`${ID5} button.redisp`).addEventListener("click", getId5data);
// document.querySelector(`${ID5} a.new`).addEventListener("click", () => {
//   document.querySelector(`${ID5} input[name='rowid']`).value = "";
//   id5FieldsList.forEach((f) => {
//     document.querySelector(`${ID5} input[name='${f}']`).value = "";
//   });
//   document.querySelector(`${ID5} .mode`).textContent = "新規";
//   document.querySelector(`${ID5} .mode`).classList.remove("text-warning");
// });
// document.querySelector(`${ID5} button.save`).addEventListener("click", async () => {
//   let saveData = [[]];
//   id5FieldsList.forEach((f) => {
//     saveData[0].push(document.querySelector(`${ID5} input[name='${f}']`).value);
//   });
//   let where = "";
//   let method = "insert";
//   let rowid = document.querySelector(`${ID5} input[name='rowid']`).value;
//   if (rowid) {
//     method = "update";
//     where = `rowid = ${rowid}`;
//     let tmp = {};
//     id5FieldsList.forEach((f, i) => {
//       tmp[f] = saveData[0][i];
//     });
//     saveData = tmp;
//   }
//   // let res = await window.eAPI.accessDb("YAKU", method, null, { recs: saveData, cond: where });
//   // if (res && res.err) showErrToast([res.err]);
//   // else showOkToast(["役情報の更新に成功しました。"]);
//   // getId5data(); // 再表示
// });
// // 役タブ ID5------------------------------
// // 選手タブ ID6------------------------------
// let id6FieldsList = ["no", "last", "first", "teamId", "teamName"];
// let getId6data = async () => {
//   // let data = await window.eAPI.accessDb("MEMBERS", "select", null, {
//   //   cond: null,
//   //   fields: `OID,${id6FieldsList.join(",")}`,
//   // });
//   // let html = "";
//   // // console.log(data);
//   // data.forEach((d) => {
//   //   html += `<tr>`;
//   //   html += id6FieldsList.reduce((l, f) => l + `<td ${f}>${d[f]}</td>`, ``);
//   //   html += `<td ope><i class="btn btn-sm btn-dark me-1 py-0 fas fa-edit" rowid="${d.rowid}"></i>
//   //   <i class="btn btn-sm btn-dark me-1 py-0 fas fa-trash-can" rowid="${d.rowid}"></i></td></tr>`;
//   // });
//   // document.querySelector(`${ID6} tbody`).innerHTML = html;
//   // document.querySelectorAll(`${ID6} i.fa-edit`).forEach((e, i) => {
//   //   e.addEventListener("click", () => {
//   //     let d = data.filter((d) => d.rowid == e.getAttribute("rowid"))[0];
//   //     document.querySelector(`${ID6} input[name='rowid']`).value = d.rowid;
//   //     id6FieldsList.forEach((f) => {
//   //       document.querySelector(`${ID6} input[name='${f}']`).value = d[f];
//   //     });
//   //     document.querySelector(`${ID6} .mode`).textContent = "編集";
//   //     document.querySelector(`${ID6} .mode`).classList.add("text-warning");
//   //   });
//   // });
//   // document.querySelectorAll(`${ID6} i.fa-trash-can`).forEach((e, i) => {
//   //   e.addEventListener("click", async () => {
//   //     let rowid = e.getAttribute("rowid");
//   //     if (rowid) {
//   //       where = `rowid = ${rowid}`;
//   //       let res = await window.eAPI.accessDb("MEMBERS", "delete", null, { cond: where });
//   //       // console.log(res);
//   //       if (res && res.err) showErrToast([res.err]);
//   //       else showOkToast(["1つの選手の削除に成功しました。"]);
//   //       getId6data(); // 再表示
//   //     }
//   //   });
//   // });
// };
// document.querySelector(`${ID6} button.redisp`).addEventListener("click", getId6data);
// document.querySelector(`${ID6} a.new`).addEventListener("click", () => {
//   document.querySelector(`${ID6} input[name='rowid']`).value = "";
//   id6FieldsList.forEach((f) => {
//     document.querySelector(`${ID6} input[name='${f}']`).value = "";
//   });
//   document.querySelector(`${ID6} .mode`).textContent = "新規";
//   document.querySelector(`${ID6} .mode`).classList.remove("text-warning");
// });
// document.querySelector(`${ID6} button.save`).addEventListener("click", async () => {
//   let saveObjs = {};
//   let messageList = [];
//   id6FieldsList.forEach((f) => {
//     saveObjs[f] = document.querySelector(`${ID6} input[name='${f}']`);
//     if (!saveObjs[f].value) {
//       if (messageList.length === 0) saveObjs[f].focus();
//       switch (f) {
//         case id6FieldsList[0]:
//           messageList.push("選手Noを入力してください");
//           break;
//         case id6FieldsList[1]:
//           messageList.push("姓を入力してください");
//           break;
//         case id6FieldsList[2]:
//           messageList.push("名を入力してください");
//           break;
//         case id6FieldsList[3]:
//           messageList.push("チームIDを入力してください");
//           break;
//         case id6FieldsList[4]:
//           messageList.push("チーム名を入力してください");
//           break;
//       }
//     }
//   });
//   if (messageList.length) {
//     showErrToast(messageList);
//     return;
//   }

//   let saveData = [[]];
//   id6FieldsList.forEach((f) => {
//     saveData[0].push(saveObjs[f].value);
//   });
//   let where = "";
//   let method = "insert";
//   let rowid = document.querySelector(`${ID6} input[name='rowid']`).value;
//   if (rowid) {
//     method = "update";
//     where = `rowid = ${rowid}`;
//     let tmp = {};
//     id6FieldsList.forEach((f, i) => {
//       tmp[f] = saveData[0][i];
//     });
//     tmp.full = `${tmp.last} ${tmp.first}`;
//     saveData = tmp;
//   } else saveData[0].splice(3, 0, `${saveObjs["last"].value} ${saveObjs["first"].value}`); // かなり強引でしゅ

//   // let res = await window.eAPI.accessDb("MEMBERS", method, null, { recs: saveData, cond: where });
//   // if (res && res.err) showErrToast([res.err]);
//   // else showOkToast(["選手情報の更新に成功しました。"]);
//   // getId6data(); // 再表示
// });
// // 選手タブ ID6------------------------------

// // タブクリック時の初期動作
// document.querySelectorAll(`li.nav-item>a`).forEach((e, i) => {
//   let tabId = e.getAttribute("href");
//   switch (tabId) {
//     case ID1:
//       break;
//     case ID2:
//       getId2data();
//       break;
//     case ID3:
//       break;
//     case ID4:
//       e.addEventListener("click", async () => {
//         getId4data();
//       });
//       break;
//     case ID5:
//       e.addEventListener("click", async () => {
//         getId5data();
//       });
//       break;
//     case ID6:
//       e.addEventListener("click", async () => {
//         getId6data();
//       });
//       break;
//   }
// });
