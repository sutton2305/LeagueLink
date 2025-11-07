
export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.log("This browser does not support desktop notification");
      return;
    }
  
    if (Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
};
  
export const sendNotification = (title: string, options?: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options);
    }
};
