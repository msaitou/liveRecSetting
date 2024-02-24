const { exec, spawn } = require("child_process");
const schedule = require("node-schedule");

const IS_WIN = process.platform === "win32";
const IS_LINUX = process.platform === "linux";
const IS_ANDROID = process.platform === "android";

if (IS_LINUX || IS_ANDROID) {
  // winは対応してません
  const schePara = { hour: 0, minute: 0, second: 0 };
  // 毎日24時から15分間、1分ごとに実行するスケジュールを設定
  const job = schedule.scheduleJob(schePara, function () {
    const interval = setInterval(function () {
      // 他のNode.jsプロセスを取得
      exec("pgrep -l node", (err, stdout, stderr) => {
        if (err) {
          console.error(`exec error: ${err}`);
          return;
        }
        let isKilled = false;
        // 各行を解析
        stdout.split("\n").forEach((line) => {
          const parts = line.split(" ");

          if (parts.length === 2) {
            const pid = parts[0];
            const name = parts[1];

            // 新たなプロセス以外のNode.jsプロセスを終了
            if (name === "node") {
              isKilled = true;
              process.kill(pid);
              console.log(`Killed process with PID: ${pid}`);
            }
          }
        });
        if (isKilled) {
          // 新たなプロセスを起動
          // const newProcess = exec("node rec.js");
          // console.log(`New process started with PID: ${newProcess.pid}`);
          child = spawn("node", ["rec.js"], {
            // shell: true,
            stdio: "ignore", // piping all stdio to /dev/null
            detached: true, // メインプロセスから切り離す設定
            env: process.env, // NODE_ENV を tick.js へ与えるため
          });
          child.unref(); // メインプロセスから切り離す
          // このプロセスIDを取得。これをkillすることで録画終了
          console.log(`New process started with PID: ${child.pid}`);
          clearInterval(interval);
        }
      });
    }, 60 * 1000); // 1分ごとに実行

    // 15分後にインターバルをクリア
    setTimeout(function () {
      clearInterval(interval);
      console.log("15分で終了");
    }, 15 * 60 * 1000);
  });
}

// nodeのエイリアスを作る？
// 時間過ぎたやつを強制済にする処理をrecに追加
// ln -s /data/data/com.termux/files/usr/bin/node /data/data/com.termux/files/home/liveRecSetting/nodekill
