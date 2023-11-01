const mongoose = require('mongoose');



const ticketSchema = new mongoose.Schema({
    name: String,
    email: String,
    status: {
      type: String,
      enum: ['new', 'inProgress', 'resolved'],
      default: 'new',
    },
    description: String,
    awsURL: String,
    imgUrl: {type: String, default: ""},

    answers: {
      type: [
        {
          answer: String,
          id: mongoose.Schema.Types.ObjectId,
        }
      ],
      default: [],
    },

    
  });
  
module.exports = mongoose.model('Ticket', ticketSchema);
  