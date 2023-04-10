const ID1 = "#addedit"; // シーズン
const ID2 = "#bookedlist"; // アカウントタブ

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
function flatpickrInit(name, d) {
  flatpickr(`[name='${name}']`, {
    locale: "ja",
    dateFormat: "m/d(D)",
    defaultDate: d,
  });
}
var bookedList = [];
// データ抽出タブ ID1------------------------------
let nameList = [
  "chanel",
  "title",
  "start_date",
  "start_time",
  "end_date",
  "end_time",
  "day0",
  "day1",
  "day2",
  "day3",
  "day4",
  "day5",
  "day6",
];
document.querySelector(`${ID1} button.save`).addEventListener("click", async () => {
  let saveObjs = {};
  let messageList = [];
  for (let f of nameList) {
    if (f == "chanel") continue;
    saveObjs[f] = document.querySelector(`${ID1} input[name='${f}']`);
    if (!saveObjs[f].value) {
      if (messageList.length === 0) saveObjs[f].focus();
      switch (f) {
        case nameList[1]:
          messageList.push("タイトルを入力してください");
          break;
        case nameList[3]:
          messageList.push("開始時刻を入力してください");
          break;
        case nameList[5]:
          messageList.push("終了時刻を入力してください");
          break;
      }
    }
  }
  if (messageList.length) {
    showErrToast(messageList);
    return;
  }
  saveObjs["chanel"] = document.querySelector(`${ID1} select[name='chanel']`);
  let doc = {};
  for (let name of nameList) {
    if (name.indexOf("day") > -1) doc[name] = saveObjs[name].checked;
    else if (name.indexOf("_date") > -1) doc[name] = saveObjs[name]._flatpickr.selectedDates[0];
    else doc[name] = saveObjs[name].value;
  }

  doc["start_date"] = new Date(
    doc["start_date"].setHours(doc["start_time"].substr(0, 2), doc["start_time"].substr(3, 2), 0, 0)
  );
  doc["end_date"] = new Date(
    doc["end_date"].setHours(doc["end_time"].substr(0, 2), doc["end_time"].substr(3, 2), 0, 0)
  );
  if (doc.start_date > doc.end_date) messageList.push("開始と終了日が逆です");
  let oid = document.querySelector(`${ID1} input[name='_id']`).value;
  bookedList.forEach((b) => {
    if (b._id == oid) return;
    if (doc.start_date <= new Date(b.start_date) && doc.end_date >= new Date(b.start_date))
      messageList.push("登録済みの録画日時と重複します");
    if (new Date(b.start_date) <= doc.start_date && new Date(b.end_date) >= doc.start_date)
      messageList.push("登録済みの録画日時と重複します2");
  });
  if (messageList.length) {
    showErrToast(messageList);
    return;
  }

  let cond = {};
  if (oid) cond = { _id: oid };
  let saveData = {
    host: DB_INFO.HOST,
    dbName: DB_INFO.DB_NAME,
    coll: "booked",
    method: "update",
    opt: { doc },
    cond,
  };
  console.log(doc);
  // return;
  await reqApi({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(saveData),
  }).then((res) => {
    console.log("aaa", res);
    getBookedList();
    newEntry();
  });
});
let getBookedList = async () => {
  let findData = {
    host: DB_INFO.HOST,
    dbName: DB_INFO.DB_NAME,
    coll: "booked",
    method: "find",
    cond: { status: { $ne: "済" } },
  };
  let data = await reqApi({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(findData),
  });
  let html = "";
  console.log(data);
  data = data.rec;
  bookedList = data;
  // オブジェクトの昇順ソート
  data.sort((a, b) => (a.start_date > b.start_date ? 1 : -1));
  data.forEach((d) => {
    html += `<tr>`;
    html += `<td>${d.title}</td>`;
    html += `<td>${new Date(d.start_date).toLocaleString()}~${new Date(d.end_date).toLocaleTimeString()}</td>`;
    html += `<td>${d.chanel}</td>`;
    html += `<td><i class="btn btn-sm btn-dark me-1 py-0 fas fa-edit" oid="${d._id}"></i>
    <i class="btn btn-sm btn-dark me-1 py-0 fas fa-trash-can" oid="${d._id}"></i></td></tr>`;
  });
  // // console.log(html);
  document.querySelector(`${ID2} tbody`).innerHTML = html;
  document.querySelectorAll(`${ID2} i.fa-edit`).forEach((e, i) => {
    e.addEventListener("click", () => {
      let d = data.filter((d) => d._id == e.getAttribute("oid"))[0];
      document.querySelector(`${ID1} input[name='_id']`).value = d._id;
      nameList.some((name) => {
        if (name.indexOf("day") > -1) document.querySelector(`${ID1} [name='${name}']`).checked = d[name];
        else if (name.indexOf("_date") > -1) flatpickrInit(name, new Date(d[name]));
        else document.querySelector(`${ID1} [name='${name}']`).value = d[name];
      });
      document.querySelector(`${ID1} .mode`).textContent = "編集";
      document.querySelector(`${ID1} .mode`).classList.add("text-warning");
    });
  });
  document.querySelectorAll(`${ID2} i.fa-trash-can`).forEach((e, i) => {
    e.addEventListener("click", async () => {
      // console.log("trash");
      let oid = e.getAttribute("oid");
      if (oid) {
        let delData = {
          host: DB_INFO.HOST,
          dbName: DB_INFO.DB_NAME,
          coll: "booked",
          method: "delete",
          cond: { _id: oid },
        };
        let res = await reqApi({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(delData),
        });
        // console.log(res);
        if (res && res.err) showErrToast([res.err]);
        else showOkToast(["1つの予約の削除に成功しました。"]);
        getBookedList(); // 再表示
      }
    });
  });
};

function newEntry() {
  document.querySelector(`${ID1} [name="_id"]`).value = "";
  document.querySelector(`${ID1} [name="chanel"]`).value = "mahjong";
  document.querySelector(`${ID1} [name="title"]`).value = "";
  document.querySelector(`${ID1} [name="start_time"]`).value = "";
  document.querySelector(`${ID1} [name="end_time"]`).value = "";
  ["start_date", "end_date"].forEach((n) => {
    let date = new Date();
    flatpickrInit(n, date); // TODO 日付を渡す（既存データ表示時）
  });
  for (let i = 0; i < 7; i++) {
    document.querySelector(`${ID1} [name="day${i}"]`).checked = false;
  }
  document.querySelector(`${ID1} .mode`).textContent = "新規";
  document.querySelector(`${ID1} .mode`).classList.remove("text-warning");
}
function mleageNewEntry() {
  document.querySelector(`${ID1} [name="_id"]`).value = "";
  document.querySelector(`${ID1} [name="chanel"]`).value = "mahjong";
  document.querySelector(`${ID1} [name="title"]`).value = "Mリーグ";
  document.querySelector(`${ID1} [name="start_time"]`).value = "19:00";
  document.querySelector(`${ID1} [name="end_time"]`).value = "00:00";
  ["start_date", "end_date"].forEach((n) => {
    let date = new Date();
    if (n == "end_date") date.setDate(date.getDate() + 1);
    flatpickrInit(n, date); // TODO 日付を渡す（既存データ表示時）
  });
  for (let i = 0; i < 7; i++) {
    document.querySelector(`${ID1} [name="day${i}"]`).checked = false;
  }
  document.querySelector(`${ID1} .mode`).textContent = "新規";
  document.querySelector(`${ID1} .mode`).classList.remove("text-warning");
}
// 新規で入力する
document.querySelector(`${ID1} a.new`).addEventListener("click", (e) => {
  newEntry();
});
// Mリーグ用の入力補助する
document.querySelector(`${ID1} a.mleague`).addEventListener("click", (e) => {
  mleageNewEntry();
});
// Mリーグ用の入力補助する
document.querySelector(`${ID2} button.redisp`).addEventListener("click", (e) => {
  getBookedList();
});
getBookedList();
newEntry();
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
