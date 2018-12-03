'use strict';
const http = require('http');
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements


// Imports the Google Cloud client library
const Datastore = require('@google-cloud/datastore');
// Your Google Cloud Platform project ID
const projectId = 'scoreboard-3';
// Instantiates a client
const datastore = Datastore({
  projectId: projectId
});

// The kind for the new entity
const kind = 'score';

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  function welcome (agent) {
    agent.add(`Welcome to my agent!`);
  }

  function fallback (agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }
  
  function yourFunctionHandler(agent) {
     agent.add(`This message is from Dialogflow's Cloud Functions for Firebase inline editor!`);
     agent.add(new Card({
         title: `Title: this is a card title`,
         imageUrl: 'https://dialogflow.com/images/api_home_laptop.svg',
         text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
         buttonText: 'This is a button',
         buttonUrl: 'https://docs.dialogflow.com/'
       })
     );
     agent.add(new Suggestion(`Quick Reply`));
     agent.add(new Suggestion(`Suggestion`));
     agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
    }

  function addpoints(agent){
    let points = agent.parameters['points'];
    let group = agent.parameters['group'];
    
    const transaction = datastore.transaction();
    const scorekey = datastore.key([kind, group]);

    transaction
        .run()
        .then(() => transaction.get(scorekey))
        .then(results => {
        //   console.log(results);
          const score = results[0];
          score.points += points;
          transaction.save({
            key: scorekey,
            data: score,
          });
          return transaction.commit();
        })
        .then(() => {
          // The transaction completed successfully.
          console.log(`Added ${points} points to ${group}.`);
        })
        .catch(err => {
            transaction.rollback();
            console.error('ERROR:', err);
        });
    agent.add(`Added ${points} points to ${group}.`);
    }

  function addbuckets(agent){
    let group = agent.parameters['group'];
    
    const score_key = datastore.key([kind, group]);
    const score = {
        key: score_key,
        data: {
            points: 0
        }
    }
    
    datastore
        .save(score)
        .then(() => {
        console.log(`Added ${group} to the scoreboard.`);
        })
        .catch(err => {
            console.error('ERROR:', err);
        });
    
    agent.add(`Added ${group} to the scoreboard.`);
  }

  function getstandings(agent){
    const query = datastore.createQuery(kind).order('points');
    
    datastore
        .runQuery(query)
        .then(results => {
          var standings = []
          const scores = results[0];
          scores.forEach(score => {
            const group = score[datastore.KEY].name;
            const points = score.points;
            standings.push(`${group}, ${points} points`);
          });
          return standings
        })
        .then( standings =>{
            console.log(standings);
        })
        .catch(err => {
          console.error('ERROR:', err);
        });
    agent.add('datastore response time is too long for dialogflow');


  }
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('git intent', yourFunctionHandler);
  intentMap.set('add bucket', addbuckets);
  intentMap.set('add points', addpoints);
  intentMap.set('get standings', getstandings);

  agent.handleRequest(intentMap);

});