/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */

const { MongoClient, ObjectId } = require("mongodb");
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
      if (Array.isArray(cond._id)) {
        cond._id = {
          $in: cond._id.reduce((p, n) => {
            p.push(new ObjectId(n));
            return p;
          }, []),
        };
      } else cond._id = new ObjectId(cond._id);
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
      case "delete":
        rec = await collection.deleteMany(cond);
      default:
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
