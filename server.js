// require('dotenv').config({ path: "../.env" });
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const Ticket = require('./models/Ticket');

//aws
const { GetObjectCommand, PutObjectCommand, ListObjectsCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const randomBytes = require('randombytes');
const multer = require('multer');


const bucketName = process.env.BUCKET_NAME
const bucketRegion = process.env.BUCKET_REGION
const accessKey = process.env.ACCESS_KEY
const secretAcessKey = process.env.SECRET_ACCESS_KEY

const s3ClientPersonal = new S3Client({
  credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretAcessKey
  },
  region: bucketRegion,

});


//multer
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })


const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

app.use(express.json());


var corsOptions = {
  origin: "http://localhost:5173",
  credentials: true
};

app.use(cors(corsOptions));

//create ticket
app.use('/api/tickets/create', upload.single('image'), async (req, res) => {

  if(!req.body?.name 
    || !req.body?.email
    || !req.body?.description 
     ) {
    return res.status(400).json({'meesage': 'fields required'}) 
  }
  try {
    const { name, email, description} = req.body;

    const file = req.file 
    console.log(req.file, file)


    const rawBytes = await randomBytes(16)
    const imageName = rawBytes.toString('hex')

    const key = `tickets/${imageName}`;

    const params = ({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer

  });

   const command = new PutObjectCommand(params)
   await s3ClientPersonal.send(command);

    const newTicket = new Ticket({ name, email, description, awsURL: imageName });

    const savedTicket = await newTicket.save();

    res.status(201).json(savedTicket);
    
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Failed to create a ticket' });
  }

});

//list tickets
app.use('/api/tickets/list', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ date: -1 });

    const ticketwithimg = [];


    for (const ticket of tickets) { 

      const { awsURL } = ticket
      console.log(awsURL, 'awsURL')
      const key = `tickets/${awsURL}/`;

      const getObjectParams = {
          Bucket: bucketName,
          Key: key
    }
  
    const command = new ListObjectsCommand(getObjectParams);
    const { Contents } = await s3ClientPersonal.send(command);
    // console.log(Contents)
    
    if (Contents.length > 0) { 

      const matchingObjects = []
      for (const obj of Contents){
          const parts = obj.Key.split('/');
          if(parts[1] === awsURL){
              matchingObjects.push(obj.Key)
          }
          const firstFound = matchingObjects[0]
          // console.log(firstFound,'firstFound')
          const firstImageUrl = `https://susshi-images.s3.us-east-1.amazonaws.com/${firstFound}`;
          ticket.imgUrl = firstImageUrl
      }
    }
    ticketwithimg.push(ticket)
  }


    res.status(200).json(ticketwithimg);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tickets' });
  }
});





app.use('/api/tickets/:id', async (req, res) => {
  console.log('hit')
  console.log(req.params)

  try {
    const ticket = await Ticket.findById(req.params.id);

    res.status(200).json(ticket);

  } catch(err){
    res.status(500).json({ error: "Could not fetch ticket" });

  }

});



app.use('/api/answer', async (req, res) => {
  const { ticketId, answer } = req.body;
  console.log('hit', ticketId, answer  )

  try {
    const ticket = await Ticket.findById({ _id: ticketId});
    console.log(ticket)

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const newAnswer = {
      answer,
      id: new mongoose.Types.ObjectId(),
    };

    ticket.answers.push(newAnswer);

    ticket.status = 'inProgress';

    await ticket.save();

    res.status(201).json({ ticket });
  } catch (error) {
    console.log(error.message)
    res.status(500).json({ error: 'Failed to create answer and update ticket' });
  }
})


app.use('/api/update-status', async (req, res) => {
  const { newStatus, ticketId } = req.body;

  try {

        const ticket = await Ticket.findById(ticketId);

        if (!ticket) {
          return res.status(404).json({ error: 'Ticket not found' });
        }
    
        ticket.status = newStatus;
    
        await ticket.save();
    
        res.status(200).json({ ticket });

  } catch(err){
    res.status(500).json({ error: 'Failed to update ticket status' });

  }

})
 



mongoose.connect('mongodb://127.0.0.1:27017/tickets', 
{ useNewUrlParser: true, useUnifiedTopology: true }
).then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
