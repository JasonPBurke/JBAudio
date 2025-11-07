import { useEffect, useState } from 'react';
// import database from '@/db';

export const useObserveWatermelonData = (
  database: any,
  tableName: string,
  queryFn = (collection: any) => collection.query()
) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const collection = database.collections.get(tableName);
    const observable = queryFn(collection).observe();

    const subscription = observable.subscribe((value: any) => {
      setData(value);
    });
    return () => subscription.unsubscribe();
  }, [database, tableName, queryFn]);

  // console.log('data', data);
  return data;
};
