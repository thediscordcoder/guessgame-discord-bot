const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let userSchema = new Schema({
    userid: String,
    wins: {
        type: Number,
        default: 0
    },
    loss: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Users', userSchema);