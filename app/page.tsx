import { supabase } from '@/lib/supabase';

export default async function Home() {
  const { data, error } = await supabase.from('users').select('*');

  return (
    <div>
      <h1>Users</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}