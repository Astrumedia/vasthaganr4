const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

exports.notifyNewBoardInformation = onDocumentCreated('latestFeed/{itemId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data() || {};

  // Only new, published items created for "Styrelsen informerar" trigger notifications.
  if (data.published !== true) return;
  if (data.sourceUrl !== 'styrelseninformerar.html') return;
  if (data.sourceType !== 'boardInfo') return;

  const title = 'Västhaga Nr4';
  const body = `Ny information från styrelsen: ${String(data.title || 'Ny information').slice(0, 180)}`;
  const url = 'https://vasthaganr4.se/styrelseninformerar.html';

  const tokenSnap = await db.collection('pushSubscriptions')
    .where('active', '==', true)
    .get();

  const tokens = [];
  tokenSnap.forEach((doc) => {
    const token = doc.get('token');
    if (typeof token === 'string' && token.length > 0) tokens.push({ doc, token });
  });

  if (!tokens.length) {
    logger.info('No active push subscriptions found.', { itemId: event.params.itemId });
    return;
  }

  let sent = 0;
  let failed = 0;

  // FCM multicast accepts up to 500 registration tokens per request.
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    // Send a data-only message. The service worker is then responsible for
    // displaying the notification, which avoids duplicate notifications.
    const response = await messaging.sendEachForMulticast({
      tokens: batch.map((entry) => entry.token),
      data: {
        title,
        body,
        url,
        source: 'boardInfo',
        itemId: event.params.itemId
      }
    });

    sent += response.successCount;
    failed += response.failureCount;

    const invalidTokenPromises = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;

      const code = result.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token')
      ) {
        invalidTokenPromises.push(
          batch[index].doc.ref.set({ active: false, updatedAt: Date.now() }, { merge: true })
        );
      }
    });

    await Promise.all(invalidTokenPromises);
  }

  logger.info('Board notification sent.', {
    itemId: event.params.itemId,
    sent,
    failed,
    tokenCount: tokens.length
  });
});
