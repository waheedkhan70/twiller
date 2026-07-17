import React from 'react';
import { useNotification } from '@/context/NotificationContext';
import { Bell } from 'lucide-react';
import { Card, CardContent } from './ui/card';

export default function NotificationsPage() {
  const { notificationsList, clearNotifications, markAsRead } = useNotification();
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">Notifications</h1>
        {notificationsList.length > 0 && (
           <button onClick={clearNotifications} className="text-sm text-blue-400 hover:underline">Clear all</button>
        )}
      </div>
      <div className="divide-y divide-gray-800">
        {notificationsList.length === 0 ? (
           <div className="p-12 text-center text-gray-500">
             <Bell className="mx-auto h-12 w-12 mb-4 opacity-30" />
             <p className="text-lg">No notifications yet</p>
             <p className="text-sm mt-2">When someone tweets about "science" or "cricket", it will show up here.</p>
           </div>
        ) : (
           notificationsList.map(n => (
             <Card 
               key={n.id} 
               className={`border-none rounded-none transition-colors cursor-pointer ${n.read ? 'bg-black hover:bg-gray-900/50' : 'bg-gray-900/40 hover:bg-gray-900/60'}`}
               onClick={() => !n.read && markAsRead(n.id)}
             >
               <CardContent className="p-4 relative">
                 {!n.read && (
                   <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-500" />
                 )}
                 <div className="flex items-start space-x-3">
                   <div className="bg-blue-500/20 p-2 rounded-full">
                     <Bell className="h-5 w-5 text-blue-400" />
                   </div>
                   <div>
                     <p className="font-bold text-white">{n.authorName} <span className="font-normal text-gray-400">posted a trending tweet</span></p>
                     <p className="text-gray-300 mt-1">{n.content}</p>
                     <p className="text-xs text-gray-500 mt-2">{new Date(n.timestamp).toLocaleTimeString()}</p>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))
        )}
      </div>
    </div>
  );
}
