import React from 'react';

import { DataSet } from '../data';

export default React.createContext<DataSet>(undefined as any);

export const DataSetProviderContext = React.createContext<
  (dataSet: DataSet) => void
>(undefined as any);
