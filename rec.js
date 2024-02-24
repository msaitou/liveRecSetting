// winかlinuxかでコマンドが変わるだけ
const { execSync, spawn } = require("child_process");
const { DB_INFO } = require("./config.js");
const fs = require("fs");
const IS_WIN = process.platform === "win32";
const IS_LINUX = process.platform === "linux";
const IS_ANDROID = process.platform === "android";
const PS = {
  WIN: {
    PS: {
      NAME: "streamlink",
      CHECK_CMD: "Get-Process -name ",
      KILL_CMD: "Stop-Process -Id ",
    },
  },
  LINUX: {
    PS: {
      NAME: "streamlink",
      CHECK_CMD: "ps -ae | grep ",
      KILL_CMD: "kill ",
    },
  },
};
const comApiData = { host: DB_INFO.HOST, dbName: DB_INFO.DB_NAME };
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
const sleep = (waitTime) => new Promise((resolve) => setTimeout(resolve, waitTime));
/**
 * 日付からyymmddの文字列を作成し返す
 * @param {*} date
 * @returns
 */
const getYYMMDDStr = (date) => {
  let d = date ? date : new Date();
  return (
    d.getFullYear().toString().substring(2) +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0")
  );
};

async function mainWin() {
  let count = 0;
  const PS_CHECK_CMD = `${PS.WIN.PS.CHECK_CMD}${PS.WIN.PS.NAME}`;
  const monitoring = async () => {
    console.log(count++);
    // プロセスが生きてるかチェック
    let isLive = false;
    var child = spawn("powershell.exe", ["-Command", "-"]);
    let self = { stout: "", sterr: "" };

    let ok = () => {
      return new Promise((res, rej) => {
        child.stdout.on("end", function (data) {
          console.log("end");
          res();
        });
      });
    };
    child.stdout.on("data", function (data) {
      let stout = data.toString();
      stout = stout.split("\n").join("").split("\r").join("").trim();
      if (stout) console.log("stdout: " + stout), (self.stout += stout);
    });
    child.stderr.on("data", function (data) {
      self.sterr = data.toString();
      console.log("stderr: " + self.sterr);
    });
    try {
      child.stdin.write(PS_CHECK_CMD + "\n");
      child.stdin.end();
      await ok();
      // console.log("ok:  ", self.stout);
      // isLive = true;
    } catch (e) {
      console.log("errrrrr");
      console.log(e);
      // 生きてない
    }
    if (self.stout) isLive = true;
    self = { stout: "", sterr: "" };
    if (!isLive) {
      // あんまりDB問い合わせたくないからとりあえず、1タスクで。並列実行は可能だが。

      // DBから持ってきて、未来の開始日の内、5分以内のデータを絞る。あれば進。
      let findData = {
        ...comApiData,
        coll: "booked",
        method: "find",
        cond: { status: { $ne: "済" } },
      };
      let data = await reqApi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(findData),
      });
      data = data.rec;
      // console.log(data);
      let candi = [];
      let now = new Date();
      let now5 = new Date();
      now5.setMinutes(now5.getMinutes() + 5);
      if (data && data.length) {
        candi = data.filter((d) => new Date(d.start_date) <= now5 && new Date(d.start_date) > now);
      }
      if (candi.length) {
        // 1件しかない想定
        let sleepTime = new Date(candi[0].start_date).getTime() - now.getTime();
        console.log("sleep前", new Date().toLocaleString(), sleepTime);
        await sleep(sleepTime);
        console.log("sleep後", new Date().toLocaleString());
        const getJifunStr = (t1, t2) => {
          let diff = t1.getTime() - t2.getTime();
          //HH部分取得
          let diffHour = diff / (1000 * 60 * 60);
          //MM部分取得
          let diffMinute = (diffHour - Math.floor(diffHour)) * 60;
          return `${Math.floor(diffHour).toString().padStart(2, "0")}:${Math.floor(diffMinute)
            .toString()
            .padStart(2, "0")}:00`;
        };
        let jifunStr = getJifunStr(new Date(candi[0].end_date), new Date(candi[0].start_date));

        // 開始時間まで寝る。
        let cmds = [
          `-p`,
          DB_INFO.REC.PLAYER,
          `https://abema.tv/now-on-air/${candi[0].chanel}`,
          `480p`,
          `-o`,
          `${DB_INFO.REC.DIR}${candi[0].title}.ts`,
          `--hls-duration`,
          jifunStr, // [HH:]MM:SS
        ];
        // streamlink -p "C:\Program Files (x86)\GRETECH\GomPlayer\GOM.exe" https://abema.tv/now-on-air/mahjong 360p -o .\test2.mp4
        try {
          // もし5分以内なら、今時間から開始時間の差分をsleepする
          // 起動(非同期)
          child = spawn(PS.WIN.PS.NAME, cmds, {
            // shell: true,
            stdio: "ignore", // piping all stdio to /dev/null
            detached: true, // メインプロセスから切り離す設定
            env: process.env, // NODE_ENV を tick.js へ与えるため
          });
          child.unref(); // メインプロセスから切り離す
          // このプロセスIDを取得。これをkillすることで録画終了
          console.log(child.pid);
          let recTime = new Date(candi[0].end_date).getTime() - new Date(candi[0].start_date).getTime();
          // 終了時間までのミリ秒待機。
          await sleep(recTime);

          const PS_KILL_CMD = `${PS.WIN.PS.KILL_CMD}${child.pid}`;
          child = spawn("powershell.exe", ["-Command", "-"]);
          await child.stdin.write(PS_KILL_CMD + "\n");
          child.stdin.end();
          await sleep(2000);
          // & 'C:\Program Files\Streamlink\ffmpeg\ffmpeg.exe' -i .\Mリーグ_230411.mp4 -vcodec copy -acodec copy .\Mリーグ_230411_2.mp4
          const PS_CMD_FFMPEG = `& ${DB_INFO.FFMPEG} -i "${DB_INFO.REC.DIR}${candi[0].title}.ts" -vcodec copy -acodec copy "${DB_INFO.REC.DIR}${candi[0].title}.mp4"`;
          child = spawn("powershell.exe", ["-Command", "-"]);
          let ok = () => {
            return new Promise((res, rej) => {
              child.stdout.on("end", function (data) {
                console.log("end");
                res();
              });
            });
          };
          child.stdout.on("data", function (data) {
            let stout = data.toString();
            stout = stout.split("\n").join("").split("\r").join("").trim();
            if (stout) console.log("stdout: " + stout), (self.stout += stout);
          });
          child.stderr.on("data", function (data) {
            self.sterr = data.toString();
            console.log("stderr: " + self.sterr);
          });
          await child.stdin.write(PS_CMD_FFMPEG + "\n");
          child.stdin.end();
          await ok();
          // await ok();
          // console.log("ok:  ", self.stout);
          console.log("録画終了"); // --hls-duration [HH:]MM:SS
          fs.unlinkSync(`${DB_INFO.REC.DIR}${candi[0].title}.ts`);
          console.log("元ファイルを削除しました"); // --hls-duration [HH:]MM:SS
          // console.log(data);
          // そのあと、bookedの中に繰り返しがありそれが、1週間後までの間に無ければ、コピーして登録
          let srcRecs = {};
          data.forEach((d) => {
            let key = `${d.chanel}${d.start_time}`;
            if (!(key in srcRecs)) srcRecs[key] = [];
            srcRecs[key].push(d);
          });
          let saveDatas = [];
          if (Object.keys(srcRecs).length) {
            // 1週間後までの間で登録していない日付を割り出す。
            // 登録済みのデータで存在しない日付をフィルタリング
            let fDates = []; // 1週間の日付配列
            for (let i = 1; i < 8; i++) {
              let d = new Date();
              d.setDate(d.getDate() + i);
              fDates.push(d.toLocaleDateString());
            }
            // 登録データから登録されてない日付と日付をキーに元データを詰める
            for (let [key, lines] of Object.entries(srcRecs)) {
              let tmpFdate = [...fDates];
              for (let line of lines) {
                let dateStr = new Date(line.start_date).toLocaleDateString();
                if (tmpFdate.indexOf(dateStr) > -1) tmpFdate.splice(tmpFdate.indexOf(dateStr), 1);
              }
              if (tmpFdate.length) {
                for (let fd of tmpFdate) {
                  let dNum = new Date(fd).getDay();
                  let sRec = { ...lines[0] };
                  if (!sRec[`day${dNum}`]) continue; // この曜日が無効ならスキップ
                  delete sRec._id;
                  let sDate, eDate;
                  sDate = new Date(fd);
                  sDate.setHours(sRec.start_time.substr(0, 2), sRec.start_time.substr(3, 2), 0, 0);
                  sRec.start_date = sDate;
                  eDate = new Date(fd);
                  eDate.setHours(sRec.end_time.substr(0, 2), sRec.end_time.substr(3, 2), 0, 0);
                  sRec.end_date = eDate;
                  if (sRec.end_date < sRec.start_date) sRec.end_date.setDate(sRec.end_date.getDate() + 1);
                  sRec.title = sRec.title.substr(0, sRec.title.indexOf("_")) + `_${getYYMMDDStr(sDate)}`;
                  saveDatas.push(sRec);
                }
              }
            }
            console.log(JSON.stringify(saveDatas));
            if (saveDatas.length) {
              let insertData = {
                host: DB_INFO.HOST,
                dbName: DB_INFO.DB_NAME,
                coll: "booked",
                method: "insertMany",
                opt: { doc: saveDatas },
              };
              let data = await reqApi({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(insertData),
              });
              console.log(JSON.stringify(data));
            }
          }
          // 登録済みにする
          let updateData = {
            ...comApiData,
            coll: "booked",
            method: "update",
            cond: { _id: candi[0]._id },
            opt: { doc: { status: "済" } },
          };
          let data2 = await reqApi({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateData),
          });
          console.log(JSON.stringify(data2));

          let delRec = data.filter(
            (d) => new Date(d.start_date).getTime() < new Date().getTime() - 24 * 60 * 60 * 1000
          );
          if (delRec.length) {
            let delIds = delRec.reduce((p, n) => {
              p.push(n._id);
              return p;
            }, []);
            // 登録済みにする
            let delData = {
              ...comApiData,
              coll: "booked",
              method: "delete",
              cond: { _id: delIds },
            };
            let data3 = await reqApi({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(delData),
            });
            console.log(JSON.stringify(data3));
          }
          // そのあと、bookedの中に繰り返しがありそれが、1週間後までの間に無ければ、コピーして登録
        } catch (e) {
          console.log(e);
        }
      }
    }
  };
  await monitoring();
  await setInterval(monitoring, 5 * 1000 * 60); // 5分毎にチェックでエンドレス
  // await setInterval(monitoring, 20 * 1000); // 6分毎にチェックでエンドレス
}
async function mainLinux() {
  let count = 0;
  const PS_CHECK_CMD = `${PS.LINUX.PS.CHECK_CMD}${PS.LINUX.PS.NAME}`;
  const monitoring = async () => {
    try {
      console.log(count++);
      console.log(1);
      // DBから持ってきて、未来の開始日の内、5分以内のデータを絞る。あれば進。
      let findData = {
        ...comApiData,
        coll: "booked",
        method: "find",
        cond: { status: null },
      };
      // console.log(2);
      let data = await reqApi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(findData),
      });
      data = data.rec;
      // console.log(3);
      // console.log(data);
      let candi = [];
      let now = new Date();
      let now5 = new Date();
      now5.setMinutes(now5.getMinutes() + 5);
      if (data && data.length)
        candi = data.filter(
          (d) => new Date(d.start_date) <= now5 || (new Date(d.start_date) < now && new Date(d.end_date) > now)
        );
      if (candi.length) {
        console.log(4);
        //オブジェクトの昇順ソート
        candi = candi.sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
        let cnt = 0;
        // 複数ある想定
        candi.reduce(async (a, candiLine, index) => {
          console.log(5);
          try {
            // もし5分以内なら、今時間から開始時間の差分を 開始時間まで寝る。
            let sleepTime = new Date(candiLine.start_date).getTime() - now.getTime();
            console.log("sleep前", new Date().toLocaleString(), sleepTime);
            await updateRec(comApiData, candiLine._id, "中");
            await sleep(sleepTime + cnt++ * 1000);
            console.log("sleep後", new Date().toLocaleString());
            const getJifunStr = (t1, t2) => {
              let diff = t1.getTime() - t2.getTime();
              //HH部分取得
              let diffHour = diff / (1000 * 60 * 60);
              //MM部分取得
              let diffMinute = (diffHour - Math.floor(diffHour)) * 60;
              return `${Math.floor(diffHour).toString().padStart(2, "0")}:${Math.floor(diffMinute)
                .toString()
                .padStart(2, "0")}:00`;
            };
            let jifunStr = getJifunStr(new Date(candiLine.end_date), new Date(candiLine.start_date));

            let cmds = [
              `-p`,
              DB_INFO.REC.PLAYER,
              `https://abema.tv/now-on-air/${candiLine.chanel}`,
              `480p`,
              `-o`,
              `${DB_INFO.REC.DIR}${candiLine.title}.ts`,
              `--hls-duration`,
              jifunStr, // [HH:]MM:SS
            ];
            // streamlink -p "C:\Program Files (x86)\GRETECH\GomPlayer\GOM.exe" https://abema.tv/now-on-air/mahjong 360p -o .\test2.mp4
            // console.log(6);
            // 起動(非同期)
            let child = spawn(PS.LINUX.PS.NAME, cmds, {
              // shell: true,
              stdio: "ignore", // piping all stdio to /dev/null
              detached: true, // メインプロセスから切り離す設定
              env: process.env, // NODE_ENV を tick.js へ与えるため
            });
            child.unref(); // メインプロセスから切り離す

            // このプロセスIDを取得。これをkillすることで録画終了
            let recTime = new Date(candiLine.end_date).getTime() - new Date(candiLine.start_date).getTime();
            // 開始時間から遅れて始める場合は、今から終了時間までの時間にする必要あり
            if (new Date(candiLine.start_date) < now) recTime = new Date(candiLine.end_date).getTime() - now.getTime();
            console.log(child.pid, recTime/1000/60, candiLine.title);
            await sleep(recTime); // 終了時間までのミリ秒待機。
            const PS_KILL_CMD = `${PS.LINUX.PS.KILL_CMD}${child.pid}`;
            // & 'C:\Program Files\Streamlink\ffmpeg\ffmpeg.exe' -i .\Mリーグ_230411.mp4 -vcodec copy -acodec copy .\Mリーグ_230411_2.mp4
            const PS_CMD_FFMPEG = `${DB_INFO.FFMPEG} -i "${DB_INFO.REC.DIR}${candiLine.title}.ts" -vcodec copy -acodec copy "${DB_INFO.REC.OUTPUT}${candiLine.title}.mp4" > /dev/null 2>&1`;
            try {
              console.log(8);
              const stdout = execSync(PS_KILL_CMD);
              // console.log(stdout.toString());
            } catch (e) {
              console.log(e.toString());
            }
            try {
              console.log(9);
              const stdout = execSync(PS_CMD_FFMPEG);
              // console.log(stdout.toString()); // この出力がかなりでかくなることがある
            } catch (e) {
              console.log("some error!!!");
              // console.log(e.toString());
            }
            console.log("録画終了"); // --hls-duration [HH:]MM:SS
            fs.unlinkSync(`${DB_INFO.REC.DIR}${candiLine.title}.ts`);
            console.log("元ファイルを削除しました"); // --hls-duration [HH:]MM:SS
            await updateRec(comApiData, candiLine._id, "済");

            let delRec = data.filter(
              (d) => new Date(d.start_date).getTime() < new Date().getTime() - 24 * 60 * 60 * 1000
            );
            if (delRec.length) {
              let delIds = delRec.reduce((p, n) => {
                p.push(n._id);
                return p;
              }, []);
              // 登録済みにする
              let delData = {
                ...comApiData,
                coll: "booked",
                method: "delete",
                cond: { _id: delIds },
              };
              let data3 = await reqApi({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(delData),
              });
              console.log(JSON.stringify(data3));
            }
          } catch (e) {
            console.log(e);
          }
          try {
            // console.log(data);
            // そのあと、bookedの中に繰り返しがありそれが、1週間後までの間に無ければ、コピーして登録
            let srcRecs = {};
            data.forEach((d) => {
              let key = `${d.chanel}${d.start_time}`;
              if (!(key in srcRecs)) srcRecs[key] = [];
              srcRecs[key].push(d);
            });
            let saveDatas = [];
            if (Object.keys(srcRecs).length) {
              // 1週間後までの間で登録していない日付を割り出す。
              // 登録済みのデータで存在しない日付をフィルタリング
              let fDates = []; // 1週間の日付配列
              for (let i = 1; i < 8; i++) {
                let d = new Date();
                d.setDate(d.getDate() + i);
                fDates.push(d.toLocaleDateString());
              }
              // 登録データから登録されてない日付と日付をキーに元データを詰める
              for (let [key, lines] of Object.entries(srcRecs)) {
                let tmpFdate = [...fDates];
                for (let line of lines) {
                  let dateStr = new Date(line.start_date).toLocaleDateString();
                  if (tmpFdate.indexOf(dateStr) > -1) tmpFdate.splice(tmpFdate.indexOf(dateStr), 1);
                }
                if (tmpFdate.length) {
                  for (let fd of tmpFdate) {
                    let dNum = new Date(fd).getDay();
                    let sRec = { ...lines[0] };
                    if (!sRec[`day${dNum}`]) continue; // この曜日が無効ならスキップ
                    delete sRec._id;
                    let sDate, eDate;
                    sDate = new Date(fd);
                    sDate.setHours(sRec.start_time.substr(0, 2), sRec.start_time.substr(3, 2), 0, 0);
                    sRec.start_date = sDate;
                    eDate = new Date(fd);
                    eDate.setHours(sRec.end_time.substr(0, 2), sRec.end_time.substr(3, 2), 0, 0);
                    sRec.end_date = eDate;
                    if (sRec.end_date < sRec.start_date) sRec.end_date.setDate(sRec.end_date.getDate() + 1);
                    sRec.title = sRec.title.substr(0, sRec.title.indexOf("_")) + `_${getYYMMDDStr(sDate)}`;
                    saveDatas.push(sRec);
                  }
                }
              }
              console.log(JSON.stringify(saveDatas));
              if (saveDatas.length) {
                let insertData = {
                  host: DB_INFO.HOST,
                  dbName: DB_INFO.DB_NAME,
                  coll: "booked",
                  method: "insertMany",
                  opt: { doc: saveDatas },
                };
                let data = await reqApi({
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(insertData),
                });
                console.log(JSON.stringify(data));
              }
            }
            // そのあと、bookedの中に繰り返しがありそれが、1週間後までの間に無ければ、コピーして登録
          } catch (e) {
            console.log(e);
          }
        }, null);
      }
    } catch (e) {
      console.log(e);
    }
  };
  const monitoringWithTimeout = async () => {
    await monitoring();
    setTimeout(monitoringWithTimeout, 1 * 1000 * 60); // 5分毎にチェック
  };
  monitoringWithTimeout(); // 関数を呼び出して開始
  // await monitoring();
  // setInterval(monitoring, 1 * 1000 * 60); // 1分毎にチェックでエンドレス
}
if (IS_LINUX || IS_ANDROID) {
  mainLinux();
} else {
  mainWin();
}
async function updateRec(comApiData, id, status) {
  // 登録済みにする
  let updateData = {
    ...comApiData,
    coll: "booked",
    method: "update",
    cond: { _id: id },
    opt: { doc: { status: status } },
  };
  let data2 = await reqApi({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  });
  console.log(JSON.stringify(data2));
}
