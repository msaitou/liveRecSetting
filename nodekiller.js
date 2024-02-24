const { exec, spawn } = require("child_process");
const schedule = require("node-schedule");
const fs = require("fs");
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
      exec("pgrep -l -x node", (err, stdout, stderr) => {
        if (err) {
          console.error(`exec error: ${err}`);
          return;
        }
        let isKilled = false;
        // 各行を解析
        if (stdout.split("\n").length < 3) return;
        stdout.split("\n").forEach((line) => {
          const parts = line.split(" ");
          if (parts.length === 2)
            if (parts[1] === "node") {
              // 新たなプロセス以外のNode.jsプロセスを終了
              isKilled = true;
              process.kill(parts[0]);
              console.log(`Killed process with PID: ${parts[0]}`);
            }
        });
        if (isKilled) {
          const out = fs.openSync('nohup.out', 'a'); // append mode
          // 新たなプロセスを起動
          child = spawn("node", ["rec.js"], {
            stdio: ["ignore", out, "ignore"], // piping stdout to nohup.out
            // stdio: ['ignore'], // piping stdout to nohup.out
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
// logcatの出力を保存する
