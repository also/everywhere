import { useState } from 'react';
import { ObjectInspector } from 'react-inspector';
import { bind, Entry, root, Traverser } from '../../../tools/parse';
import {
  iterateMetadataSamples,
  SampleMetadata,
  parser as gpmfParser,
} from '../../../tools/parse/gpmf';
import { Box } from '../../../tools/parse/mp4';
import { utf8decoder } from '../../../tools/parse/read';
import { useMemoAsync } from '../../hooks';

async function asyncArray<T>(i: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of i) {
    result.push(item);
  }
  return result;
}

function DataViewView({ value }: { value: DataView }) {
  return <div>{utf8decoder.decode(value).slice(0, 100)}</div>;
}

function TraverserValueView<T extends Entry>({
  traverser,
  entry,
  depth = 0,
}: {
  traverser: Traverser<T>;
  entry?: T;
  depth?: number;
}) {
  const state = useMemoAsync(async () => {
    const children = await asyncArray(
      traverser.iterator(entry || traverser.root)
    );
    const value = entry ? await traverser.value(entry) : undefined;
    return { children, value };
  }, [traverser, entry]);

  if (depth > 8) {
    return <div>oops</div>;
  } else if (state) {
    const { children, value } = state;

    return (
      <>
        {value ? (
          <pre>
            {value instanceof DataView ? (
              <DataViewView value={value} />
            ) : (
              <ObjectInspector data={value} expandPaths={['$']} />
              // JSON.stringify(value, null, 2)
            )}
          </pre>
        ) : null}
        <ul>
          {children.map((e) => (
            <li key={e.fileOffset}>
              <TraverserView
                traverser={traverser.clone()}
                entry={e}
                depth={depth + 1}
              />
            </li>
          ))}
        </ul>
      </>
    );
  } else {
    return <div>loading...</div>;
  }
}

export default function TraverserView<T extends Entry>({
  traverser,
  entry,
  depth = 0,
}: {
  traverser: Traverser<T>;
  entry?: T;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (depth > 8) {
    return <div>oops</div>;
  }

  return (
    <>
      <div onClick={() => setExpanded(!expanded)}>
        {entry ? (
          <>
            <code>{entry.fourcc}</code> (file offset: {entry.fileOffset},
            length: {entry.len})
          </>
        ) : (
          '(root)'
        )}
      </div>
      {expanded ? (
        <TraverserValueView
          traverser={traverser.clone()}
          entry={entry || traverser.root}
          depth={depth}
        />
      ) : null}
    </>
  );
}

export function GpmfSamples({
  sampleMetadata,
  mp4,
}: {
  sampleMetadata: SampleMetadata;
  mp4: Traverser<Box>;
}) {
  const samples = useMemoAsync(
    () => asyncArray(iterateMetadataSamples(sampleMetadata)),
    [sampleMetadata]
  );

  if (!samples) {
    return <div>loading...</div>;
  } else {
    const [sample] = samples;
    const gpmf = bind(gpmfParser, mp4.data, root(sample.offset, sample.size));
    return (
      <div>
        {samples.length} samples
        <TraverserView traverser={gpmf.clone()} />
      </div>
    );
  }
}
