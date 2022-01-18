module.exports.name = "";
module.exports.email = "@gmail.com";

module.exports.topic_name = 'projects/';
module.exports.subscription_name = 'projects/';

module.exports.valid_senders = [];
module.exports.body_regex = /mailto:(?:(?:[^<>()[\]\\.,;:\s@"]+(?:\.[^<>()[\]\\.,;:\s@"]+)*)|(?:".+"))@(?:(?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(?:(?:[a-z\-0-9]+\.)+[a-z]{2,}))/i;
module.exports.subject_regex = /[a-z]/;

// program will send a test body with a test subject
// on match with your email address above it will send out the confirmation body
// on recieving the confirmation body it will send out the init body to tell you it is working

module.exports.confirmation_body = `Thanks for doing a thing!`;
module.exports.confirmation_subject = `Subject that you've done a thing`;
module.exports.init_body = `notifying client that <b>regex observer</b> is operational . . . `;
module.exports.init_subject = `INITIALIZE GMAIL NOTIFICATIONS`;
module.exports.fail_subject = `GMAIL REGEX NOTIFICATIONS HAS FAILED`;
module.exports.test_subject = ``;
module.exports.test_body = ``;
