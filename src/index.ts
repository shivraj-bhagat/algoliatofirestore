/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin/app";
import * as firestore from "firebase-admin/firestore";
import * as algoliasearch from "algoliasearch";

admin.initializeApp();
const db = firestore.getFirestore();

const algoliaClient = algoliasearch.default(
  functions.config().algolia.appid,
  functions.config().algolia.apikey
);

const collectionIndex = algoliaClient.initIndex("qa_driver_lead_algo");
const firestoreCollection = "driver_lead";

export const sendCollectionToAlgolia = functions.https.onRequest(
  async (req, res) => {
    const algoliaRecords: any[] = [];
    const querySnapshot = await db.collection(firestoreCollection).get();
    querySnapshot.docs.forEach((doc: any) => {
      const document = doc.data();
      const record: any = {
        objectID: doc.id,
        relevantProperty1: document.relevantProperty1,
        relevantProperty2: document.relevantProperty2,
        relevantPropertyN: document.relevantPropertyN,
      };
      record.created_datetime = new Date(
        record.created_datetime.toDate()
      ).valueOf();
      if (record.update_datetime) {
        record.update_datetime = new Date(
          record.update_datetime.toDate()
        ).valueOf();
      }
      if (record.session_date) {
        record.session_date = new Date(record.session_date.toDate()).valueOf();
      }
      algoliaRecords.push(record);
    });
    collectionIndex.saveObjects(algoliaRecords, (_error: any, content: any) => {
      res
        .status(200)
        .send(`${firestoreCollection} was indexed to Algolia successfully.`);
    });
  }
);

export const driverLeadOnCreate = functions.firestore
  .document(`${firestoreCollection}/{docId}`)
  .onCreate(async (snapshot, context) => {
    await saveDocumentInAlgolia(snapshot);
  });

export const driverLeadOnUpdate = functions.firestore
  .document(`${firestoreCollection}/{docId}`)
  .onUpdate(async (change, context) => {
    await updateDocumentInAlgolia(change);
  });

export const driverLeadOnDelete = functions.firestore
  .document(`${firestoreCollection}/{docId}`)
  .onDelete(async (snapshot, context) => {
    await deleteDocumentFromAlgolia(snapshot);
  });

async function saveDocumentInAlgolia(snapshot: any) {
  if (snapshot.exists) {
    const record = snapshot.data();
    if (record) {
      record.objectID = snapshot.id;
      record.created_datetime = new Date(
        record.created_datetime.toDate()
      ).valueOf();
      if (record.update_datetime) {
        record.update_datetime = new Date(
          record.update_datetime.toDate()
        ).valueOf();
      }
      if (record.session_date) {
        record.session_date = new Date(record.session_date.toDate()).valueOf();
      }
      await collectionIndex.saveObject(record);
    }
  }
}

async function updateDocumentInAlgolia(
  change: functions.Change<FirebaseFirestore.DocumentSnapshot>
) {
  const docBeforeChange = change.before.data();
  const docAfterChange = change.after.data();
  if (docBeforeChange && docAfterChange) {
    await deleteDocumentFromAlgolia(change.after);
    await saveDocumentInAlgolia(change.after);
  }
}

async function deleteDocumentFromAlgolia(
  snapshot: FirebaseFirestore.DocumentSnapshot
) {
  if (snapshot.exists) {
    const objectID = snapshot.id;
    await collectionIndex.deleteObject(objectID);
  }
}
