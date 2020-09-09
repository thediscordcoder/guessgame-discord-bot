require("dotenv").config();

const Discord = require('discord.js');
const client = new Discord.Client();
const User = require('../model/user.model');
const mongoose = require('mongoose');

const PREFIX = "!";

let gamesOn = new Map();

let playing = [];
let userGameMap = new Map();
let invitations = new Map();

let gamecount = 0;
let invitecount = 0;

function getIdFromMention(mention) {
    if (!mention) return;

    if (mention.startsWith('<@') && mention.endsWith('>')) {
        mention = mention.slice(2, -1);

        if (mention.startsWith('!')) {
            mention = mention.slice(1);
        }

        return mention;
    }
}

function addInvite(inviteid, userid1, userid2, mode, channelid) {
    invitations.set(inviteid, {
        id: inviteid,
        userid1: userid1,
        userid2: userid2,
        mode: mode,
        channelid: channelid
    });
}

function addGame(gameid, userid1, userid2, mode, channelid) {

    // Math.floor(Math.random() * 10) + 1; 

    let number, turnid;
    if (mode.toLowerCase() === 'easy')
        number = Math.floor(Math.random() * 50) + 1;
    else if (mode.toLowerCase() === 'medium')
        number = Math.floor(Math.random() * 100) + 1;
    else if (mode.toLowerCase() === 'hard')
        number = Math.floor(Math.random() * 200) + 1;

    let who = Math.floor(Math.random() * 10) + 1;

    if (who % 2 === 0)
        turnid = userid1;
    else
        turnid = userid2;

    gamesOn.set(gameid, {
        id: gameid,
        userid1: userid1,
        userid2: userid2,
        channel: channelid,
        number: number,
        turnid: turnid,
    });

    return gamesOn.get(gameid);
}

function changeTurn(gameid) {
    let { gid, userid1, userid2, channelid, number, turnid } = gamesOn.get(gameid);
    if (turnid === userid1)
        turnid = userid2;
    else
        turnid = userid1;

    gamesOn.set(gameid, {
        id: gameid,
        userid1: userid1,
        userid2: userid2,
        channelid: channelid,
        number: number,
        turnid: turnid,
    });
}


client.on('ready', () => {
    console.log(`${client.user.username} is up and running..`);
});

client.on('message', (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    //separting command and params into different variable.

    const [command, ...args] = message.content.trim().substring(PREFIX.length).split(/\s+/);

    //command cases starts here.

    if (command !== 'gg') return;

    if (args[0] === 'invite') {
        let userid2 = getIdFromMention(args[1]);
        if (!args[2]) return message.channel.send(`${message.author} Specify a mode (Easy, Medium, Hard)`);
        let mode = args[2].toLowerCase();
        let user2 = client.users.cache.get(userid2);
        if (!user2) return message.channel.send(`${message.author} invalid user mentioned.`);
        if (user2 === message.author) return message.channel.send(`${message.author} You cannot invite yourself.`);
        if (mode !== 'easy' && mode !== 'medium' && mode !== 'hard') return message.channel.send(`${message.author} Invalid Mode Type (Easy, Medium, Hard)`);
        if (playing.includes([userid2, message.channel.id].join(""))) return message.channel.send(`${message.author}, that user is already playing in this channel.`);
        if (playing.includes([message.author.id, message.channel.id].join(""))) return message.channel.send(`${message.author} Cannot send invitation. You're already playing in this channel.`);
        const gamemsg = new Discord.MessageEmbed()
            .setColor('#f1c40f')
            .setTitle('GuessGame Invitation')
            .setDescription(`${message.author} invites ${user2} for GuessGame.`)
            .addFields(
                { name: 'Code', value: `#${++invitecount}` }
            );

        message.channel.send(gamemsg);
        addInvite(invitecount, message.author.id, userid2, mode, message.channel.id);

    }
    else if (args[0] === 'accept') {
        if (!args[1]) return;
        if (invitations.get(parseInt(args[1]))) {
            let { userid1, userid2, mode, channelid } = invitations.get(parseInt(args[1]));
            let user1 = client.users.cache.get(userid1);
            let user2 = client.users.cache.get(userid2);

            if (channelid !== message.channel.id) return message.channel.send(`${message.author}, no invitation in this channel with that code.`);
            if (userid2 !== message.author.id) return message.channel.send(`${message.author}, that invitation isn't for you.`);
            if (playing.includes([userid1, message.channel.id].join(""))) return message.channel.send(`${message.author} that user is already in a game in this channel. `);

            message.channel.send(`${message.author} has accepted invite #${args[1]}`);

            let newgame = addGame(++gamecount, userid1, userid2, mode, message.channel.id);
            let first = client.users.cache.get(newgame.turnid);

            invitations.delete(parseInt(args[1]));

            playing.push([userid1, message.channel.id].join(""));
            playing.push([userid2, message.channel.id].join(""));

            userGameMap.set([userid1, message.channel.id].join(""), gamecount);
            userGameMap.set([userid2, message.channel.id].join(""), gamecount);

            const gamemsg = new Discord.MessageEmbed()
                .setColor('#2ecc71')
                .setTitle('GuessGame Started')
                .setThumbnail('https://i.imgur.com/IRJ6JIX.png')
                .setDescription(`${user1} and ${user2} have started playing GuessGame!\n\n ${first.username} goes first.`);

            message.channel.send(gamemsg);

        }
        else {
            message.channel.send(`${message.author} invalid invite code`);
        }
    }
    else if (args[0] == 'guess') {
        if (!playing.includes([message.author.id, message.channel.id].join(""))) return message.channel.send(`${message.author} You're not playing GuessGame with anyone in this channel.`);

        const curgame = gamesOn.get(userGameMap.get([message.author.id, message.channel.id].join("")));

        if (curgame.turnid !== message.author.id) return message.channel.send(`${message.author} Calm down. Not your turn.`);

        if (!args[1]) return message.channel.send(`${message.author} guess a number idiot.`);


        const num = curgame.number;
        const guess = parseInt(args[1]);

        if (guess > num) {
            const gamemsg = new Discord.MessageEmbed()
                .setColor('#c0392b')
                .setTitle('Guess Lower')
                .setThumbnail('https://i.imgur.com/lQv7B3c.png')
                .setDescription(`${message.author} You need to guess lower!`);

            message.channel.send(gamemsg);

            changeTurn(curgame.id);
        }
        else if (guess < num) {
            const gamemsg = new Discord.MessageEmbed()
                .setColor('#c0392b')
                .setTitle('Guess Higher!')
                .setThumbnail('https://i.imgur.com/V5XogmV.png')
                .setDescription(`${message.author} You need to guess higher!`);

            message.channel.send(gamemsg);
            changeTurn(curgame.id);
        }
        else {
            const gamemsg = new Discord.MessageEmbed()
                .setColor('#3498db')
                .setTitle('You won!')
                .setThumbnail('https://i.imgur.com/7SyVQYP.png')
                .setDescription(`${message.author} guessed it right!`);

            message.channel.send(gamemsg);

            gamesOn.delete(curgame.id);
            userGameMap.delete([curgame.userid1, message.channel.id].join(""));
            userGameMap.delete([curgame.userid2, message.channel.id].join(""));

            playing.splice(playing.indexOf([curgame.userid1, message.channel.id].join("")), 1);
            // console.log("playing removed1: ", [curgame.userid1, message.channel.id].join(""));
            // console.log(playing);
            playing.splice(playing.indexOf([curgame.userid2, message.channel.id].join("")), 1);
            // console.log("playing removed2: ", [curgame.userid2, message.channel.id].join(""));
            // console.log(playing);

            User.findOne({ userid: message.author.id }, (err, userdb) => {
                if (err) return message.channel.send(`${message.author}, an error occured.`);

                if (!userdb) {
                    User.create({ userid: message.author.id, wins: 1, loss: 0 }, (error, newUser) => {
                        if (err) return message.channel.send(`${message.author}, an error occured.`);

                    });
                }
                else {
                    userdb.wins++;
                    userdb.save((err) => {
                        if (err) return console.log("Error occured in incrementing new user's wins.");
                    })
                }
            })

            let otherid;
            if (curgame.userid1 === message.author.id)
                otherid = curgame.userid2;
            else
                otherid = curgame.userid1;

            User.findOne({ userid: otherid }, (err, userdb) => {
                if (err) return message.channel.send(`${message.author}, an error occured.`);

                if (!userdb) {
                    User.create({ userid: otherid, wins: 0, loss: 1 }, (error, newUser) => {
                        if (err) return message.channel.send(`${message.author}, an error occured.`);

                    });
                }
                else {
                    userdb.loss++;
                    userdb.save((err) => {
                        if (err) return console.log("Error occured in incrementing new user's wins.");
                    })
                }
            })

        }

    }
    else if (args[0] == 'stats') {
        if (!args[1]) {
            User.findOne({ userid: message.author.id }, (err, userdb) => {
                if (err) return message.channel.send(`${message.author}, an error occured.`);

                if (!userdb) {
                    User.create({ userid: message.author.id, wins: 0, loss: 0 }, (error, newUser) => {
                        if (err) return message.channel.send(`${message.author}, an error occured.`);
                        userdb = newUser;
                        const thisuser = client.users.cache.get(userdb.userid);
                        const gamemsg = new Discord.MessageEmbed()
                            .setColor('#9b59b6')
                            .setTitle(`GuessGame Stats`)
                            .setDescription(`${thisuser}'s GuessGame Stats`)
                            .setThumbnail(message.author.avatarURL())
                            .addFields(
                                { name: 'Wins', value: `${userdb.wins}`, inline: true },
                                { name: 'Losses', value: `${userdb.loss}`, inline: true }
                            );


                        message.channel.send(gamemsg);
                    });
                }
                else {
                    const thisuser = client.users.cache.get(userdb.userid);
                    const gamemsg = new Discord.MessageEmbed()
                        .setColor('#9b59b6')
                        .setTitle(`GuessGame Stats`)
                        .setDescription(`${thisuser}'s GuessGame Stats`)
                        .setThumbnail(message.author.avatarURL())
                        .addFields(
                            { name: 'Wins', value: `${userdb.wins}`, inline: true },
                            { name: 'Losses', value: `${userdb.loss}`, inline: true }
                        );


                    message.channel.send(gamemsg);
                }
            })
        }
        else {

            let targetuserid = getIdFromMention(args[1]);

            User.findOne({ userid: targetuserid }, (err, userdb) => {
                if (err) return message.channel.send(`${message.author}, an error occured.`);
                if (!userdb) {
                    console.log("#2");
                    User.create({ userid: targetuserid, wins: 0, loss: 0 }, (error, newUser) => {
                        if (err) return message.channel.send(`${message.author}, an error occured.`);
                        userdb = newUser;
                        const thisuser = client.users.cache.get(userdb.userid);
                        // console.log(userdb);
                        // console.log(thisuser);
                        const gamemsg = new Discord.MessageEmbed()
                            .setColor('#9b59b6')
                            .setTitle(`GuessGame Stats`)
                            .setDescription(`${thisuser}'s GuessGame Stats`)
                            //.setThumbnail('https://i.imgur.com/wSTFkRM.png')
                            .setThumbnail(thisuser.avatarURL())
                            .addFields(
                                { name: 'Wins', value: `${userdb.wins}`, inline: true },
                                { name: 'Losses', value: `${userdb.loss}`, inline: true }
                            );

                        message.channel.send(gamemsg);
                    });

                }
                else {
                    console.log("userdb exists")
                    const thisuser = client.users.cache.get(userdb.userid);
                    // console.log(userdb);
                    // console.log(thisuser);
                    const gamemsg = new Discord.MessageEmbed()
                        .setColor('#9b59b6')
                        .setTitle(`GuessGame Stats`)
                        .setDescription(`${thisuser}'s GuessGame Stats`)
                        //.setThumbnail('https://i.imgur.com/wSTFkRM.png')
                        .setThumbnail(thisuser.avatarURL())
                        .addFields(
                            { name: 'Wins', value: `${userdb.wins}`, inline: true },
                            { name: 'Losses', value: `${userdb.loss}`, inline: true }
                        );

                    message.channel.send(gamemsg);
                }

            })

        }
    }
    else if (args[0] === 'help') {
        const gamemsg = new Discord.MessageEmbed()
            .setColor('#ecf0f1')
            .setTitle(`GuessGame Help`)
            .setThumbnail('https://i.imgur.com/cRAGnBf.png')
            .setDescription(`/gg invite <user> <easy/hard/medium> - To challenge a user\nex: /gg invite @dummy easy\n
            /gg accept <invite code> - To accept someone's invitation\nex: /gg accept 5\n
            /gg guess <number> - To guess a number while in a game\n
            /gg stats <user> - To check a user's stats (if no user is passed then shows self stats)\n
            Easy: 1-50; Medium: 1-100; Hard:1-200;
            `);

        message.channel.send(gamemsg);
    }
    // else if (args[0] === 'debug') {
    //     console.log('playing---');
    //     console.log(playing);

    // }



})

mongoose.connect('mongodb://localhost/guessGame', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB Connection Error :('));
db.once('open', function () {
    console.log("[Connection] GuessGame Bot connected to MongoDB..");
});

client.login(process.env.DISCORDJS_BOT_TOKEN);