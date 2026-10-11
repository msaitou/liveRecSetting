/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */

const { MongoClient, ObjectId } = require("mongodb");
const RECORDING_CLAIM_LEASE_MS = 90 * 1000;
const m = async (req, res) => {
  console.log("m desu");
  res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTION");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  let params = req.body;
  console.log(JSON.stringify(params));
  let resObj = await mOpe(params);
  res.json(resObj);
};
async function mOpe(params) {
  if (!(params.host && params.dbName && params.coll && params.method)) return { err: "invalid params" };
  let { host, coll, dbName, method, cond, opt } = params;
  try {
    let dbInstance = new MongoClient(`mongodb://${host}`, { useNewUrlParser: true, useUnifiedTopology: true });
    const client = await dbInstance.connect();
    const db = await client.db(dbName);
    const collection = db.collection(coll);
    let rec;
    if (cond && cond._id) {
      const toMongoId = (id) =>
        typeof id === "string" && /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : id;
      if (Array.isArray(cond._id)) {
        cond._id = { $in: cond._id.map(toMongoId) };
      } else cond._id = toMongoId(cond._id);
    }
    switch (method) {
      case "find":
        rec = await collection.find(cond);
        if (opt && opt.sort) {
          rec = await rec.sort(opt.sort);
        }
        if (opt && opt.limit) {
          rec = await rec.limit(opt.limit);
        }
        rec = await rec.toArray();
        break;
      case "findOne":
        rec = await collection.findOne(cond);
        break;
      case "claimRecording":
        if (!cond || !cond._id || !opt || !opt.token) {
          throw new Error("claimRecording requires an _id and token");
        }
        const now = new Date();
        rec = await collection.updateOne(
          {
            _id: cond._id,
            $or: [
              { status: null },
              { status: "中", claimUntil: { $exists: false } },
              { status: "中", claimUntil: { $lte: now } },
            ],
          },
          {
            $set: {
              status: "中",
              claimToken: opt.token,
              claimUntil: new Date(now.getTime() + RECORDING_CLAIM_LEASE_MS),
            },
          }
        );
        break;
      case "renewRecordingClaim":
        if (!cond || !cond._id || !opt || !opt.token) {
          throw new Error("renewRecordingClaim requires an _id and token");
        }
        rec = await collection.updateOne(
          { _id: cond._id, status: "中", claimToken: opt.token },
          { $set: { claimUntil: new Date(Date.now() + RECORDING_CLAIM_LEASE_MS) } }
        );
        break;
      case "completeRecording":
        if (!cond || !cond._id || !opt || !opt.token) {
          throw new Error("completeRecording requires an _id and token");
        }
        rec = await collection.updateOne(
          { _id: cond._id, status: "中", claimToken: opt.token },
          { $set: { status: "済" }, $unset: { claimToken: "", claimUntil: "" } }
        );
        break;
      case "releaseRecordingClaim":
        if (!cond || !cond._id || !opt || !opt.token) {
          throw new Error("releaseRecordingClaim requires an _id and token");
        }
        rec = await collection.updateOne(
          { _id: cond._id, status: "中", claimToken: opt.token },
          { $set: { status: null }, $unset: { claimToken: "", claimUntil: "" } }
        );
        break;
      case "update":
        let cnt = 0;
        if (cond && Object.keys(cond).length > 0) {
          cnt = await collection.countDocuments(cond);
        }
        if (cnt) {
          rec = await collection.updateOne(cond, { $set: opt.doc });
        } else {
          // insert
          rec = await collection.insertOne(opt.doc);
        }
        break;
      case "insertMany":
        rec = await collection.insertMany(opt.doc);
        break;
      case "insertManyIfAbsent":
        rec = { insertedCount: 0 };
        for (const doc of opt.doc) {
          if (doc._id == null) throw new Error("insertManyIfAbsent requires every document to have an _id");
          try {
            const result = await collection.updateOne(
              { _id: doc._id },
              { $setOnInsert: doc },
              { upsert: true }
            );
            rec.insertedCount += result.upsertedCount;
          } catch (e) {
            if (e.code !== 11000) throw e;
            const existing = await collection.findOne({ _id: doc._id }, { projection: { _id: 1 } });
            if (!existing) throw e;
          }
        }
        break;
      case "delete":
        rec = await collection.deleteMany(cond);
        break;
      default:
        throw new Error(`unsupported method: ${method}`);
    }
    dbInstance.close();
    return { rec };
  } catch (e) {
    return { err: e.toString() };
  }
}
// function repeatBook() {
//   // 登録済み(status！=済)の中で繰り返しがあるデータについて、コピーする
//   mOpe({});
//   //登録されてる最後のレコードの繰り返し情報が優先。
// }
exports.m = m;
