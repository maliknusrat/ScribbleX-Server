const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;


app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

//middleware
app.use(cors({
  origin: [
    // 'http://localhost:5173/'
    'https://scribblex-2b479.web.app',
    'https://scribblex-2b479.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

//middlewares
const logger = (req, res, next) => {
  console.log('logInfo', req.method, req.url);
  next();
}

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log('tokken in the middleware', token);
  if (!token) {
    return res.status(401).send({ message: 'unauthorized' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized' })
    }
  })
  req.user = decoded;
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dhjafvg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const blogCollection = client.db("scribblexdb").collection('blogs');
    const wishBlogCollection = client.db("scribblexdb").collection('wishlist');
    const subsceiberCollection = client.db("scribblexdb").collection('subcription');

    //auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        // sameSite: 'none'
      }).send({ success: true });
    })

    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('logging out', user);
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })


    app.get('/blog', async (req, res) => {
      console.log('token owner info', req.user);
      const cousor = blogCollection.find();
      const result = (await cousor.toArray()).reverse();
      res.send(result);
    })

    // logger, verifyToken,

    app.get('/categoryBlog/:id', async (req, res) => {
      const id = req.params.id;
      // if (req.user.email !== req.query.email) {
      //   return req.status(403).send({ massage: 'forbidden access' })
      // }
      const allBlogs = await blogCollection.find().toArray();
      if (id == 'All') {
        const result = await blogCollection.find().toArray();
        res.send(result);
      } else {
        const reqBlog = allBlogs.filter(blog => blog.category == id);
        res.send(reqBlog);
      }
    })

    app.get('/blogDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await blogCollection.findOne(query);
      console.log(result);
      res.send(result);
    })

    app.post('/wishlist/:id', async (req, res) => {
      const body = req.body;
      const result = await wishBlogCollection.insertOne(body);
      res.send(result);
    })

    app.get('/wishlists/:id', async (req, res) => {

      const id = req.params.id;
      const query = { user: id }
      // console.log(query);
      const result = await wishBlogCollection.find(query).toArray();
      res.send(result)
    })

    app.delete('/wishlists/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await wishBlogCollection.deleteOne(query);
      res.send(result);
    })

    //connnect with database
    app.post('/subcription', async (req, res) => {
      const newsub = req.body;
      console.log(newsub);
      const result = await subsceiberCollection.insertOne(newsub);
      res.send(result)
    })

    app.put('/addComment/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const feedbackBody = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const giveFeedback = {
        $push: {
          comment: feedbackBody
        }
      }
      const result = await blogCollection.updateOne(filter, giveFeedback, options);
      res.send(result);
    })

    // const indexKeys = { blogTitle: 1 }
    // const indexOptions = { name: 'blogTitleSearch' };
    // const result = await blogCollection.createIndex(indexKeys, indexOptions);

    app.get('/search/:text', async (req, res) => {
      const searchText = req.params.text;
      const result = await blogCollection.find({
        $or: [
          { blogTitle: { $regex: searchText, $options: "i" } }
        ]
      }).toArray();
      res.send(result);
    })


    app.put('/blogUpdate/:id', async (req, res) => {
      const id = req.params.id;
      const userBody = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const giveFeedback = {
        $set: {
          blogTitle: userBody.blogTitle,
          image: userBody.image,
          category: userBody.category,
          shortDescription: userBody.shortDescription,
          details: userBody.details
        }
      }
      const result = await blogCollection.updateOne(filter, giveFeedback, options);
      res.send(result);
    })

    app.post('/blog', async (req, res) => {
      const newblog = req.body;
      // console.log(newblog);
      const result = await blogCollection.insertOne(newblog);
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('ScribbleX is Running')
})

app.listen(port, () => {
  console.log(`Server is Running on port ${port}`);
})
