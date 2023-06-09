// winかlinuxかでコマンドが変わるだけ
const { spawn } = require("child_process");
const { DB_INFO } = require("./config.js");
const fs = require("fs");
const IS_WIN = process.platform === "win32";
const IS_LINUX = process.platform === "linux";
const PS = {
  WIN: {
    PS: {
      NAME: "streamlink",
      CHECK_CMD: "Get-Process -name ",
      KILL_CMD: "Stop-Process -Id ",
      KILL_OTHER: "chrome",
    },
  },
  LINUX: {
    PS: {
      NAME: "node-sss",
      CHECK_CMD: "ps -ae | grep ",
      KILL_CMD: "killall ",
      KILL_OTHER: " chrome chromedriver",
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
    if (isLive) {
      //   console.log("生きてるよ");
      //   let fileStatus = fs.statSync(LOG_FILE);
      //   // 生きてる場合、ログファイルの更新時間を取得
      //   if (lastLogTime) {
      //     // 前回の更新時間と比較
      //     console.log(
      //       lastLogTime.toString(),
      //       fileStatus.mtime.toString(),
      //       lastLogTime.toString() === fileStatus.mtime.toString()
      //     );
      //     if (lastLogTime.toString() === fileStatus.mtime.toString()) {
      //       // 変化がなければプロセスをキルする
      //       // const stdout = execSync(PS_KILL_CMD);
      //       // console.log('dededede');
      //       isLive = false;
      //     }
      //     // 変化があれば何もしない
      //   }
      //   console.log(fileStatus.mtime);
      //   lastLogTime = fileStatus.mtime;
    }
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
if (IS_LINUX) {
  console.log("未対応");
} else if (false) {
  let cmds = [
    `-p`,
    `${DB_INFO.REC.PLAYER}`,
    `https://abema.tv/now-on-air/mahjong`,
    `360p`,
    `-o`,
    `${DB_INFO.REC.DIR}test2.mp4`,
  ];
  // streamlink -p "C:\Program Files (x86)\GRETECH\GomPlayer\GOM.exe" https://abema.tv/now-on-air/mahjong 360p -o .\test2.mp4

  // REC: { PLAYER: "'C:\\Program Files (x86)\\GRETECH\\GomPlayer\\GOM.exe'", DIR: ".\\" },
  try {
    async function sss() {
      let findData = {
        ...comApiData,
        coll: "booked",
        method: "find",
        cond: {
          status: { $ne: "済" },
          $or: [
            { day0: true },
            { day1: true },
            { day2: true },
            { day3: true },
            { day4: true },
            { day5: true },
            { day6: true },
          ],
        },
      };
      let data = await reqApi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(findData),
      });
      data = data.rec;
      console.log(data);
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
        for (let i = 0; i < 7; i++) {
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
              sRec.title += `_${getYYMMDDStr(sDate)}`;
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
      let delRec = data.filter((d) => new Date(d.start_date).getTime() < new Date().getTime() - 24 * 60 * 60 * 1000);
      if (delRec.length) {
        // 登録済みにする
        let updateData = {
          ...comApiData,
          coll: "booked",
          method: "update",
          cond: { _id: delRec[0]._id }, // TODO
          opt: { doc: { status: "済" } },
        };
        let data2 = await reqApi({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });
        console.log(JSON.stringify(data2));

        // 登録済みにする
        let delData = {
          ...comApiData,
          coll: "booked",
          method: "delete",
          cond: { _id: [delRec[0]._id] }, // TODO
        };
        let data3 = await reqApi({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(delData),
        });
        console.log(JSON.stringify(data3));
      }
    }
    async function ddd() {
      // & 'C:\Program Files\Streamlink\ffmpeg\ffmpeg.exe' -i .\Mリーグ_230411.mp4 -vcodec copy -acodec copy .\Mリーグ_230411_2.mp4
      const PS_CMD_FFMPEG = `& ${DB_INFO.FFMPEG} -i "${DB_INFO.REC.DIR}test.ts" -vcodec copy -acodec copy "${DB_INFO.REC.DIR}test.mp4"`;
      let child = spawn("powershell.exe", ["-Command", "-"]);
      await child.stdin.write(PS_CMD_FFMPEG + "\n");
      child.stdin.end();
    }
    // sss();
    ddd();
  } catch (e) {
    console.log(e);
  }
} else {
  mainWin();
}
