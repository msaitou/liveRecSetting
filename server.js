const express = require("express");

// const conf = require("config");
const port = 3333;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTION");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
app.get("/", async (req, res) => {
  // await db("abema_sche_rec");
  console.log("kita");
  let recs = await db("auth_user", "find");
  console.log(recs);
  res.json({});
});
app.post("/", async (req, res) => {
  // await db("abema_sche_rec");
  console.log("post kita", req.body);
  let recs = await db(
    "clonecopyfake:coL1ZQI575JtJPml@ac-ml7ibpw-shard-00-00.nbx1dwk.mongodb.net:27017,ac-ml7ibpw-shard-00-01.nbx1dwk.mongodb.net:27017,ac-ml7ibpw-shard-00-02.nbx1dwk.mongodb.net:27017/?ssl=true&replicaSet=atlas-5e5461-shard-0&authSource=admin&retryWrites=true&w=majority",
    "auth_user",
    "find"
  );
  // console.log(recs);
  res.json({ recs });
});
app.listen(port);

const { MongoClient } = require("mongodb");
async function db(host, coll, method, cond = {}, opt = {}) {
  try {
    let db = new MongoClient(`mongodb://${host}`, { useNewUrlParser: true, useUnifiedTopology: true });
    const client = await db.connect();
    const dbName = await client.db("c2v");
    const collection = dbName.collection(coll);
    let res;
    switch (method) {
      case "find":
        res = await collection.find(cond);
        if (opt.sort) {
          res = await res.sort(opt.sort);
        }
        if (opt.limit) {
          res = await res.limit(opt.limit);
        }
        res = await res.toArray();
        break;
      case "findOne":
        res = await collection.findOne(cond);
        break;
      case "update":
        let cnt = 0;
        if (cond) {
          cnt = await collection.countDocuments(cond);
        }
        if (cnt) {
          res = await collection.updateOne(cond, { $set: doc });
        } else {
          // insert
          res = await collection.insertOne(doc);
        }
        break;
      case "insertMany":
        res = await collection.insertMany(doc);
        break;
      case "delete":
        res = await collection.deleteMany(doc);
      default:
    }
    db.close();
    return res;
  } catch (e) {
    throw e;
  }
}
