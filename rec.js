// winかlinuxかでコマンドが変わるだけ
const { execSync, spawn } = require("child_process");
const { createHash, randomBytes } = require("crypto");
const { createInterface } = require("readline");
const { DB_INFO } = require("./config.js");
const fs = require("fs");
const IS_WIN = process.platform === "win32";
const IS_LINUX = process.platform === "linux";
const IS_ANDROID = process.platform === "android";
const IS_TERMUX =
  (IS_LINUX || IS_ANDROID) &&
  [process.env.PREFIX, process.env.HOME].some(
    (path) => typeof path === "string" && path.indexOf("/com.termux/") !== -1
  );
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
  // return fetch(`${url}${query}`, params)
  return fetch(`${url}${query}`, { ...params, signal: AbortSignal.timeout(60 * 1000) })
    .then((res) => res.json())
    .catch((err) => {
      console.log(err);
      console.log("err");
    });
};
const sleep = (waitTime) => new Promise((resolve) => setTimeout(resolve, waitTime));
const CLAIM_LEASE_MS = 5 * 60 * 1000;
const CLAIM_RENEW_INTERVAL_MS = 60 * 1000;
const RECORDING_PREROLL_MS = 4 * 60 * 1000;
const STREAMLINK_LOG_MILESTONES = [
  [/\[plugins\.abematv\].*\bURL=/i, "abema-playlist-url"],
  [/\[cli\]\[info\] Found matching plugin/i, "plugin-matched"],
  [/\[cli\]\[info\] Available streams:/i, "streams-available"],
  [/\[cli\]\[info\] Opening stream:/i, "stream-opening"],
  [/\[cli\]\[info\] Writing output to/i, "output-opening"],
  [/Filtering out segments and pausing stream output/i, "output-paused-filtering"],
  [/Resuming stream output/i, "output-resumed"],
  [/Writing stream to output/i, "first-stream-write"],
  [/\b(?:GET|POST|PUT|HEAD)\s+https?:\/\//i, "http-request"],
  [/\bHTTP\/\d(?:\.\d)?\s+[1-5]\d\d\b|\bresponse\b.*\bstatus\b/i, "http-response"],
];
const getRepeatId = (record) => {
  const identity = JSON.stringify([
    record.chanel,
    new Date(record.start_date).toISOString(),
    record.title,
  ]);
  return `repeat:${createHash("sha256").update(identity).digest("hex")}`;
};
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
          let diffHour = diff / (1000 * 60 * 60);
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
                  sRec._id = getRepeatId(sRec);
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
                method: "insertManyIfAbsent",
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
  console.log(
    `[録画] 実行環境 platform=${process.platform} termux=${IS_TERMUX} ` +
      `PREFIX=${process.env.PREFIX || "未設定"}`
  );
  if (IS_TERMUX) {
    try {
      execSync("termux-wake-lock", { stdio: "ignore" });
      console.log("[録画] Termux Wake Lockを取得しました");
      process.once("exit", () => {
        try {
          execSync("termux-wake-unlock", { stdio: "ignore" });
        } catch (e) {
          console.error(`[録画] Termux Wake Lock解放エラー: ${e.toString()}`);
        }
      });
    } catch (e) {
      console.error(`[録画] Termux Wake Lock取得エラー。端末スリープ中は予約時刻どおりに動作しない可能性があります: ${e.toString()}`);
    }
  }
  let count = 0;
  const PS_CHECK_CMD = `${PS.LINUX.PS.CHECK_CMD}${PS.LINUX.PS.NAME}`;
  const monitoring = async () => {
    try {
      console.log(count++);
      // DBから持ってきて、未来の開始日の内、5分以内のデータを絞る。あれば進。
      let findData = {
        ...comApiData,
        coll: "booked",
        method: "find",
        cond: { status: { $in: [null, "中"] } },
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
          (d) => {
            const startTime = new Date(d.start_date).getTime();
            const endTime = new Date(d.end_date).getTime();
            const claimExpired =
              d.status !== "中" || !d.claimUntil || new Date(d.claimUntil).getTime() <= now.getTime();
            return startTime <= now5.getTime() && endTime > now.getTime() && claimExpired;
          }
        );
      if (candi.length) {
        console.log(4);
        //オブジェクトの昇順ソート
        candi = candi.sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
        let cnt = 0;
        // 複数ある想定
        candi.reduce(async (a, candiLine, index) => {
          console.log(5);
          let claimToken = null;
          let claimTimer = null;
          let child;
          let claimLost = false;
          let claimRenewalInProgress = false;
          let claimRenewalFailed = false;
          let resolveClaimLost;
          const claimLostSignal = new Promise((resolve) => {
            resolveClaimLost = resolve;
          });
          let childClosePromise = null;
          let childClosed = false;
          let stoppingChildPromise = null;
          const signalChild = (signal) => {
            if (!child || !child.pid) return;
            try {
              process.kill(-child.pid, signal);
            } catch (e) {
              if (e.code !== "ESRCH") throw e;
              try {
                process.kill(child.pid, signal);
              } catch (childError) {
                if (childError.code !== "ESRCH") throw childError;
              }
            }
          };
          const waitForChildClose = async (timeoutMs) =>
            Promise.race([childClosePromise.then(() => true), sleep(timeoutMs).then(() => false)]);
          const stopChild = () => {
            if (stoppingChildPromise) return stoppingChildPromise;
            stoppingChildPromise = (async () => {
              if (!child || !child.pid || !childClosePromise || childClosed) return;
              console.log(`[録画] Streamlink停止シグナル送信 signal=SIGTERM pid=${child.pid}`);
              signalChild("SIGTERM");
              if (await waitForChildClose(5000)) return;
              console.error(`[録画] Streamlinkが5秒以内に停止しないため強制終了します pid=${child.pid}`);
              signalChild("SIGKILL");
              if (!(await waitForChildClose(5000))) {
                throw new Error(`Streamlink終了を確認できません pid=${child.pid}`);
              }
              console.log(`[録画] Streamlink強制終了を確認しました pid=${child.pid}`);
            })();
            return stoppingChildPromise;
          };
          try {
            const scheduledStart = new Date(candiLine.start_date).getTime();
            const plannedCaptureStart = scheduledStart - RECORDING_PREROLL_MS;
            let sleepTime = plannedCaptureStart - Date.now();
            console.log(
              `[録画] 開始待機 ${Math.max(0, sleepTime)}ms ` +
                `予定開始=${new Date(scheduledStart).toISOString()} ` +
                `前倒し=${RECORDING_PREROLL_MS / 1000}秒 ${new Date().toLocaleString()}`
            );
            const requestedClaimToken = randomBytes(16).toString("hex");
            const claimResult = await claimRec(comApiData, candiLine._id, requestedClaimToken);
            if (!claimResult.claimed) {
              const claimUntil = claimResult.currentClaimUntil
                ? new Date(claimResult.currentClaimUntil).toISOString()
                : "なし";
              console.log(
                `[録画] 予約を確保できません status=${claimResult.currentStatus ?? "なし"} ` +
                  `lockUntil=${claimUntil} title=${candiLine.title}`
              );
              return;
            }
            claimToken = requestedClaimToken;
            claimTimer = setInterval(async () => {
              if (claimRenewalInProgress || claimLost) return;
              claimRenewalInProgress = true;
              try {
                const renewed = await renewRec(comApiData, candiLine._id, claimToken);
                if (renewed.modifiedCount !== 1) {
                  claimLost = true;
                  clearInterval(claimTimer);
                  console.error(
                    `[録画] 予約ロックを失いました: ${candiLine.title} ` +
                      `pid=${child ? child.pid : "未起動"} status=${renewed.currentStatus ?? "なし"} ` +
                      `lockUntil=${renewed.currentClaimUntil ? new Date(renewed.currentClaimUntil).toISOString() : "なし"} ` +
                      `tokenMatches=${renewed.tokenMatches}`
                  );
                  try {
                    await stopChild();
                  } catch (e) {
                    console.error(`[録画] Streamlink停止エラー: ${e.toString()}`);
                  } finally {
                    resolveClaimLost();
                  }
                } else if (claimRenewalFailed) {
                  claimRenewalFailed = false;
                  console.log(`[録画] 予約ロック更新が復旧しました: ${candiLine.title}`);
                }
              } catch (e) {
                if (!claimRenewalFailed) {
                  console.error(
                    `[録画] 予約ロック更新に一時失敗しました。録画は継続し、次回再試行します: ${e.toString()}`
                  );
                  claimRenewalFailed = true;
                }
              } finally {
                claimRenewalInProgress = false;
              }
            }, CLAIM_RENEW_INTERVAL_MS);
            const startWaitResult = await Promise.race([
              sleep(Math.max(0, sleepTime) + cnt++ * 1000).then(() => "start"),
              claimLostSignal.then(() => "claim-lost"),
            ]);
            if (startWaitResult === "claim-lost" || claimLost) {
              throw new Error(`予約ロックを失ったため録画を開始しません: ${candiLine.title}`);
            }
            const recordingStart = Math.max(Date.now(), plannedCaptureStart);
            console.log(
              `[録画] キャプチャ開始時刻 ${new Date(recordingStart).toISOString()} ` +
                `(予約開始 ${new Date(scheduledStart).toISOString()})`
            );
            const remainingMs = new Date(candiLine.end_date).getTime() - recordingStart;
            if (remainingMs <= 0) {
              console.log(`[録画] 終了時刻を過ぎたため開始しません: ${candiLine.title}`);
              return;
            }
            const getJifunStr = (t1, t2) => {
              let seconds = Math.ceil((t1.getTime() - t2.getTime()) / 1000);
              const hours = Math.floor(seconds / 3600);
              seconds %= 3600;
              const minutes = Math.floor(seconds / 60);
              seconds %= 60;
              return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
                .toString()
                .padStart(2, "0")}`;
            };
            let jifunStr = getJifunStr(new Date(candiLine.end_date), new Date(recordingStart));
            const inputPath = `${DB_INFO.REC.DIR}${candiLine.title}.${claimToken}.ts`;

            let cmds = [
              `--loglevel`,
              `trace`,
              `-p`,
              DB_INFO.REC.PLAYER,
              `https://abema.tv/now-on-air/${candiLine.chanel}`,
              `480p`,
              `-o`,
              inputPath,
              `--hls-duration`,
              jifunStr, // [HH:]MM:SS
            ];
            // streamlink -p "C:\Program Files (x86)\GRETECH\GomPlayer\GOM.exe" https://abema.tv/now-on-air/mahjong 360p -o .\test2.mp4
            // console.log(6);
            // 起動(非同期)
            const streamlinkRequestedAt = Date.now();
            console.log(
              `[録画] Streamlink起動要求 ${new Date(streamlinkRequestedAt).toISOString()} ` +
                `予定開始=${new Date(scheduledStart).toISOString()} title=${candiLine.title}`
            );
            child = spawn(PS.LINUX.PS.NAME, cmds, {
              stdio: ["ignore", "pipe", "pipe"],
              detached: true, // メインプロセスから切り離す設定
              env: process.env, // NODE_ENV を tick.js へ与えるため
            });
            let streamlinkFirstOutputAt = null;
            const logStreamlinkOutput = (stream, label) => {
              stream.setEncoding("utf8");
              const lines = createInterface({ input: stream, crlfDelay: Infinity });
              lines.on("line", (line) => {
                const now = Date.now();
                if (streamlinkFirstOutputAt === null) {
                  streamlinkFirstOutputAt = now;
                  console.log(
                    `[録画] Streamlink初回ログ ${new Date(now).toISOString()} ` +
                      `起動要求から=${now - streamlinkRequestedAt}ms`
                  );
                }
                const safeLine = line
                  .replace(/(authorization|cookie):.*$/gi, "$1: [REDACTED]")
                  .replace(/([?&][^=&#\s]+=)[^&#\s]*/g, "$1[REDACTED]")
                  .replace(
                    /(["']?(?:authorization|cookie|access[_-]?token|user[_-]?token|auth(?:orization)?|token|api[_-]?key|key|secret|applicationkeysecret|signature|sig|session[_-]?id|hdnea|jwt|device[_-]?id|ticket|license)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s;&}]+)/gi,
                    "$1[REDACTED]"
                  );
                console.log(`[録画][Streamlink][${label}] ${new Date(now).toISOString()} ${safeLine}`);
                for (const [pattern, phase] of STREAMLINK_LOG_MILESTONES) {
                  if (pattern.test(line)) {
                    console.log(
                      `[録画] Streamlink段階=${phase} ${new Date(now).toISOString()} ` +
                        `起動要求から=${now - streamlinkRequestedAt}ms`
                    );
                  }
                }
              });
            };
            logStreamlinkOutput(child.stdout, "stdout");
            logStreamlinkOutput(child.stderr, "stderr");
            child.once("spawn", () => {
              console.log(
                `[録画] Streamlinkプロセス起動 ${new Date().toISOString()} ` +
                  `起動要求から=${Date.now() - streamlinkRequestedAt}ms pid=${child.pid}`
              );
            });
            childClosePromise = new Promise((resolve) => {
              child.once("error", (error) => {
                childClosed = true;
                resolve({ error });
              });
              child.once("close", (code, signal) => {
                childClosed = true;
                console.log(
                  `[録画] Streamlinkプロセス終了 ${new Date().toISOString()} ` +
                    `起動要求から=${Date.now() - streamlinkRequestedAt}ms code=${code} signal=${signal}`
                );
                resolve({ code, signal });
              });
            });
            child.unref(); // メインプロセスから切り離す

            // このプロセスIDを取得。これをkillすることで録画終了
            let recTime = new Date(candiLine.end_date).getTime() - Date.now();
            const outputPath = `${DB_INFO.REC.OUTPUT}${candiLine.title}.mp4`;
            console.log(
              `[録画] Streamlink監視開始 ${new Date().toISOString()} title=${candiLine.title} ` +
                `pid=${child.pid} 予定終了=${new Date(candiLine.end_date).toISOString()} durationMs=${recTime}`
            );
            console.log(`[録画] Streamlink出力: ${inputPath}`);
            let firstFileCreatedLogged = false;
            let firstFileDataLogged = false;
            const outputFileMonitor = setInterval(() => {
              fs.stat(inputPath, (error, stat) => {
                if (error) {
                  if (error.code !== "ENOENT") {
                    console.error(`[録画] TSファイル確認エラー: ${error.toString()}`);
                  }
                  return;
                }
                if (!firstFileCreatedLogged) {
                  firstFileCreatedLogged = true;
                  const now = Date.now();
                  console.log(
                    `[録画] TSファイル作成確認 ${new Date(now).toISOString()} ` +
                      `起動要求から=${now - streamlinkRequestedAt}ms bytes=${stat.size} path=${inputPath}`
                  );
                }
                if (!firstFileDataLogged && stat.size > 0) {
                  firstFileDataLogged = true;
                  const now = Date.now();
                  console.log(
                    `[録画] TS初回データ確認 ${new Date(now).toISOString()} ` +
                      `起動要求から=${now - streamlinkRequestedAt}ms bytes=${stat.size} path=${inputPath}`
                  );
                }
              });
            }, 1000);
            child.once("close", () => clearInterval(outputFileMonitor));
            const recordingDeadline = Date.now() + Math.max(0, recTime);
            let resolveRecordingDeadline;
            let recordingDeadlineReached = false;
            const recordingDeadlineSignal = new Promise((resolve) => {
              resolveRecordingDeadline = resolve;
            });
            const recordingDeadlineTimer = setTimeout(async () => {
              recordingDeadlineReached = true;
              console.log(`[録画] 予約終了時刻に達しました。Streamlinkを停止します: ${candiLine.title}`);
              try {
                await stopChild();
                resolveRecordingDeadline({ kind: "deadline" });
              } catch (e) {
                resolveRecordingDeadline({ kind: "stop-error", error: e });
              }
            }, Math.max(0, recordingDeadline - Date.now()));
            const recordingResult = await Promise.race([
              recordingDeadlineSignal,
              claimLostSignal.then(() => ({ kind: "claim-lost" })),
              childClosePromise.then((result) =>
                recordingDeadlineReached ? recordingDeadlineSignal : { kind: "child-exit", result }
              ),
            ]);
            clearTimeout(recordingDeadlineTimer);
            if (recordingResult.kind === "claim-lost" || claimLost) {
              throw new Error(`予約ロックを失ったため録画後処理を中止します: ${candiLine.title}`);
            }
            if (recordingResult.kind === "stop-error") {
              throw recordingResult.error;
            }
            if (
              recordingResult.kind === "child-exit" &&
              (recordingResult.result.error || recordingResult.result.code !== 0)
            ) {
              throw new Error(
                `Streamlinkが異常終了しました: ${recordingResult.result.error || `code=${recordingResult.result.code} signal=${recordingResult.result.signal}`}`
              );
            }
            if (recordingResult.kind === "child-exit") {
              console.log(
                `[録画] Streamlink自然終了 code=${recordingResult.result.code} signal=${recordingResult.result.signal} ` +
                  `elapsedMs=${Date.now() - streamlinkRequestedAt}`
              );
            }
            if (
              recordingResult.kind === "child-exit" &&
              recordingResult.result.code === 0 &&
              Date.now() < recordingDeadline - 5000
            ) {
              throw new Error(`Streamlinkが終了予定時刻より早く終了しました: ${candiLine.title}`);
            }
            if (claimLost) throw new Error(`予約ロックを失ったため録画後処理を中止します: ${candiLine.title}`);
            // & 'C:\Program Files\Streamlink\ffmpeg\ffmpeg.exe' -i .\Mリーグ_230411.mp4 -vcodec copy -acodec copy .\Mリーグ_230411_2.mp4
            const PS_CMD_FFMPEG = `${DB_INFO.FFMPEG} -i "${inputPath}" -vcodec copy -acodec copy "${outputPath}"`;
            try {
              if (recordingResult.kind !== "deadline") {
                console.log(`[録画] Streamlink停止 pid=${child.pid}`);
                await stopChild();
              }
            } catch (e) {
              console.error(`[録画] Streamlink停止時のエラー: ${e.toString()}`);
              throw e;
            }
            try {
              if (!fs.existsSync(inputPath)) {
                throw new Error(`入力TSがありません: ${inputPath}`);
              }
              const inputStat = fs.statSync(inputPath);
              console.log(`[録画] FFmpeg変換開始 inputBytes=${inputStat.size} output=${outputPath}`);
              console.log(`[録画] FFmpegコマンド: ${PS_CMD_FFMPEG}`);
              await new Promise((resolve, reject) => {
                const ffmpeg = spawn("sh", ["-c", PS_CMD_FFMPEG], { stdio: "inherit" });
                ffmpeg.once("error", reject);
                ffmpeg.once("close", (code, signal) => {
                  if (code === 0) resolve();
                  else reject(new Error(`FFmpeg終了 code=${code} signal=${signal}`));
                });
              });
              if (!fs.existsSync(outputPath)) {
                throw new Error(`変換後のMP4がありません: ${outputPath}`);
              }
              const outputStat = fs.statSync(outputPath);
              if (!outputStat.isFile() || outputStat.size === 0) {
                throw new Error(`変換後のMP4が空か通常ファイルではありません: ${outputPath}`);
              }
              console.log(`[録画] FFmpeg変換成功 outputBytes=${outputStat.size} output=${outputPath}`);
            } catch (e) {
              console.error(`[録画] FFmpeg変換失敗: ${e.toString()}`);
              throw e;
            }
            if (claimLost) throw new Error(`予約ロックを失ったため録画後処理を中止します: ${candiLine.title}`);
            console.log(`[録画] MP4作成確認済み ${new Date().toISOString()}`);
            if (claimTimer) {
              clearInterval(claimTimer);
              claimTimer = null;
            }
            await completeRec(comApiData, candiLine._id, claimToken);
            claimToken = null;
            fs.unlinkSync(inputPath);
            console.log(`[録画] 元TSを削除しました: ${inputPath}`);

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
          } finally {
            if (claimTimer) clearInterval(claimTimer);
            if (claimToken) {
              try {
                await releaseRec(comApiData, candiLine._id, claimToken);
              } catch (e) {
                console.error(`[録画] 予約ロック解放エラー: ${e.toString()}`);
              }
            }
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
                    sRec._id = getRepeatId(sRec);
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
                  method: "insertManyIfAbsent",
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
    setTimeout(monitoringWithTimeout, 30 * 1000);
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

async function recordingClaimRequest(comApiData, id, method, token) {
  const claimData = {
    ...comApiData,
    coll: "booked",
    method,
    cond: { _id: id },
    opt: { token },
  };
  const result = await reqApi({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(claimData),
  });
  if (!result || result.err) {
    throw new Error(`録画予約ロック処理に失敗しました: ${result ? result.err : "API応答なし"}`);
  }
  return result.rec;
}

async function claimRec(comApiData, id, token) {
  const result = await recordingClaimRequest(comApiData, id, "claimRecording", token);
  if (!result || typeof result.claimed !== "boolean") {
    throw new Error(
      `claimRecordingの応答形式が不正です (${JSON.stringify(result)}). ` +
        "API側のm.jsを更新してデプロイしてください"
    );
  }
  return result;
}

async function renewRec(comApiData, id, token) {
  const result = await recordingClaimRequest(comApiData, id, "renewRecordingClaim", token);
  if (!result || typeof result.modifiedCount !== "number") {
    throw new Error(`renewRecordingClaimの応答形式が不正です (${JSON.stringify(result)})`);
  }
  return result;
}

async function completeRec(comApiData, id, token) {
  const result = await recordingClaimRequest(comApiData, id, "completeRecording", token);
  if (!result || result.modifiedCount !== 1) {
    throw new Error("予約ロックを確認できず、録画完了状態に更新できませんでした");
  }
}

async function releaseRec(comApiData, id, token) {
  const result = await recordingClaimRequest(comApiData, id, "releaseRecordingClaim", token);
  if (!result || result.modifiedCount !== 1) {
    console.error("予約ロックを解放できませんでした。期限切れ後に再取得されます");
  }
}