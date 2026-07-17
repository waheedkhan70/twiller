import { redirect } from 'next/navigation';

export default function NotificationRoute() {
  // Redirect back to home where the main layout handles notification state routing
  redirect('/');
}
