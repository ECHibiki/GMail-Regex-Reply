const UserConfig = require("./user-config");

// basic code from https://developers.google.com/gmail/api/quickstart/nodejs and https://cloud.google.com/docs/authentication/getting-started#windows
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
// Imports the Google Cloud client library
const {PubSub} = require('@google-cloud/pubsub');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/gmail-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/gmail.send' , 'https://www.googleapis.com/auth/gmail.readonly'];
var TOKEN_DIR = './';
var TOKEN_PATH = TOKEN_DIR + 'gmail-nodejs-quickstart.json';


var used_thread_id_list = [];

fs.readFile('response-history.json', function(err, thread_list){
  if (err) {
    console.log('Error loading Response History file: ' + err);
    return;
  }
  used_thread_id_list = JSON.parse(thread_list);

  // Load client secrets from a local file.
  fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Gmail API.
    authorize(JSON.parse(content), function(auth){
      let gmail = google.gmail({version: 'v1' , auth: auth});
      beginWatch(gmail);
      setInterval(function() { beginWatch(gmail) } , 6*24*60*60*1000);
      sendTestMessage(gmail);
    });
  });
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  gmail.users.labels.list({
    userId: 'me',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const labels = res.data.labels;
    if (labels.length) {
      console.log('Labels:');
      labels.forEach((label) => {
        console.log(`- ${label.name}`);
      });
    } else {
      console.log('No labels found.');
    }
  });
}

//h ttps://developers.google.com/gmail/api/quickstart/nodejs

const {createMimeMessage} = require('mimetext')

function createMessage(sender_obj, destination, subject, message_body){
  let message_obj = createMimeMessage();
  message_obj.setSender(sender_obj)
  message_obj.setRecipient(destination)
  message_obj.setSubject(subject)
  message_obj.setMessage('text/html', message_body)

  return {
    "raw": message_obj.asEncoded()
  }
}

function sendTestMessage(gmail){
  let msg_obj = createMessage(
    {name: UserConfig.name  , addr: UserConfig.email} ,
     UserConfig.email ,
     UserConfig.test_subject ,
     UserConfig.test_body
  );
  sendMessage(gmail , msg_obj)
}
function sendInitMessage(gmail){
  let msg_obj = createMessage(
    {name: UserConfig.name  , addr: UserConfig.email} ,
    UserConfig.email ,
    UserConfig.init_subject ,
    UserConfig.init_body
  );
  sendMessage(gmail , msg_obj)
}
function sendConfirmationMessage(gmail , destination){
  let msg_obj = createMessage(
    {name: UserConfig.name  , addr: UserConfig.email} ,
    destination ,
    UserConfig.confirmation_subject ,
    UserConfig.confirmation_body
  );
  sendMessage(gmail , msg_obj)
}
function sendFailMessage(gmail , err){
  let msg_obj = createMessage(
    {name: UserConfig.name  , addr: UserConfig.email} ,
    UserConfig.email ,
    UserConfig.fail_subject,
    JSON.stringify(err, Object.getOwnPropertyNames(err)) ,
  );
  sendMessage(gmail , msg_obj)
}



function sendMessage(gmail, msg_obj){
  gmail.users.messages.send (
    {
      // The user's email address.
      // The special value me can be used to indicate the authenticated user.
      userId: "me",
      requestBody: msg_obj
    }
    , function (err, res){
      handleAsyncGmail(gmail,
        err, function(err){console.log("Send Msg ERROR");},
        res , function (res){});
    }
  );
}

function handleAsyncGmail(gmail ,err , errCallback,  res, succesCallback ){
  if (err){
    sendFailMessage(gmail)
    errCallback(err);
    console.log(err , "E");
  } else{
    succesCallback(res)
  }
}

function beginWatch(gmail){
  gmail.users.watch({
      userId: "me",
      requestBody : {
        labelIds: ['UNREAD'],
        topicName: UserConfig.topic_name
      }
    }, function (err, res){
      handleAsyncGmail( gmail,
        err, function(err){},
        res , function (res){
          const subscriptionName = UserConfig.subscription_name;
          const timeout = 120;
          // Creates a client; cache this for further use
          const pubSubClient = new PubSub();
          let history_id = res.data.historyId;
          listenForMessages(gmail , pubSubClient , subscriptionName , history_id , timeout);
      });
    }
  );
}

// method based on https://cloud.google.com/pubsub/docs/pull
function listenForMessages(gmail , pubSubClient , subscriptionName , history_id , timeout ) {
  // References an existing subscription
  const subscription = pubSubClient.subscription(subscriptionName);

  // Create an event handler to handle messages
  let messageCount = 0;
  const messageHandler = message => {
    try{
      let _history_id = history_id;
      // update ID
      let sender_data = JSON.parse(message.data);
      history_id = sender_data.historyId;
      email_addr = sender_data.emailAddress;
      if(email_addr.toUpperCase() != UserConfig.email.toUpperCase()
        && UserConfig.valid_senders.length
        && UserConfig.valid_senders.indexOf(email_addr.toUpperCase()) == -1){
        return;
      }
      gmail.users.history.list({
        userId:"me",
        startHistoryId: _history_id
      } , function(err, res){
          handleAsyncGmail(gmail,
            err, function(err){},
            res , function (res){
              let new_posts = res.data.history;
              new_posts.forEach(function(post, i) {
                // holds a log of messages in the chain so just grab opening starter
                let used_thread_id = post.messages[0].threadId;
                let reused = determineIsReusedID(used_thread_id);
                if(!reused){
                  gmail.users.messages.get({
                    userId:"me",
                    id: used_thread_id,
                    labelIds: ["UNREAD"]
                  } , function(err, res){
                  handleAsyncGmail(gmail,
                    err, function(err){},
                    res , function (res){
                      let buff = Buffer.alloc(
                        res.data.payload.body.size,
                        res.data.payload.body.data,
                        'base64'
                      );
                      let subj = "";
                      res.data.payload.headers.forEach((header, i) => {
                        if(header.name == 'Subject'){
                          subj = header.value;
                        }
                      });
                      let text = buff.toString('utf8');
                      let response = testIfRegexMatch(text , subj , email_addr);
                      switch (response) {
                        case -1:
                          console.log("GMAIL REGEX REPLY INITIALIZED");
                          sendInitMessage(gmail)
                          break;
                        case 1:
                          let destination = text.match(UserConfig.body_regex)[0];
                          sendConfirmationMessage(gmail , destination.replace("mailto:" , ""));
                          break;
                        default:
                      }
                    }
                  );
                });
              }
            });
        });
      });
    }catch(e){
      console.log("Message Fail" , e) ;
      //TODO write this to my email instead of console.log
      // console.log(message) ;
    }
    // "Ack" (acknowledge receipt of) the message
    message.ack();
  };

  // Listen for new messages until timeout is hit
  subscription.removeListener('message', messageHandler);
  subscription.on('message', messageHandler);

}

function determineIsReusedID(thread_id){
  if(used_thread_id_list.indexOf(thread_id) == -1){
    used_thread_id_list.push(thread_id);
    fs.writeFile('response-history.json', JSON.stringify(used_thread_id_list), (err) => {
      if (err) return console.error(err);
    });
    return false;
  } else{
    return true;
  }
}

function testIfRegexMatch(text_body , text_subject , email_addr){
  if(UserConfig.subject_regex.test(text_subject) && UserConfig.body_regex.test(text_body)){
    // send a confirmation that this message is from the set of verified senders and matches a pattern of subject and body
      return 1;
  } else if(email_addr.toUpperCase() == UserConfig.email.toUpperCase() &&
      text_subject == UserConfig.confirmation_subject &&
      text_body == UserConfig.confirmation_body
    ){
      // if it's an init message that follows a confirmation, aka a confirmation sent to self
       return -1;
  }
  return 0;
}
