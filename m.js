/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */

const { MongoClient } = require("mongodb");
exports.m = async (req, res) => {
  console.log("m desu");
  res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTION");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  let params = req.body;
  console.log(JSON.stringify(params));
  if (!(params.host && params.dbName && params.coll && params.method)) return res.json({ err: "invalid params" });
  let { host, coll, dbName, method, cond, opt } = params;
  try {
    let dbInstance = new MongoClient(`mongodb://${host}`, { useNewUrlParser: true, useUnifiedTopology: true });
    const client = await dbInstance.connect();
    const db = await client.db(dbName);
    const collection = db.collection(coll);
    let rec;
    switch (method) {
      case "find":
        rec = await collection.find(cond);
        if (opt.sort) {
          rec = await rec.sort(opt.sort);
        }
        if (opt.limit) {
          rec = await rec.limit(opt.limit);
        }
        rec = await rec.toArray();
        break;
      case "findOne":
        rec = await collection.findOne(cond);
        break;
      case "update":
        let cnt = 0;
        if (cond) {
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
        rec = await collection.deleteMany(opt.doc);
      default:
    }
    dbInstance.close();
    return res.json({ rec });
  } catch (e) {
    return res.json({ err: e.toString() });
  }
};
