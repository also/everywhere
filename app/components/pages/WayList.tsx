import { HTMLAttributes, useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

import PageTitle from '../PageTitle';
import MapComponent, { MapMouseHandler } from '../stylized/Map';
import Ways from '../stylized/Ways';
import WayListColumns from '../WayListColumns';
import { GroupedWays, WayFeature, WayTree } from '../../ways';
import StandardPage from '../StandardPage';
import { nearestLine } from '../../geo';

function WayMap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative inline-block', className)} {...props} />;
}

function WayHoverInfo({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // position kind of inside somerville
        'absolute top-[350px] left-[400px] bg-[#eee] p-[0.4em] font-bold shadow-[3px_3px_0_0_#dfdfdf]',
        className
      )}
      {...props}
    />
  );
}

const HoverStreetMap = function WayList({ wayTree }: { wayTree: WayTree }) {
  const navigate = useNavigate();
  const [hoveredStreet, setHoveredStreet] = useState<WayFeature>();
  const onMouseMove: MapMouseHandler = useCallback(
    ({ geo }) => setHoveredStreet(nearestLine(wayTree, geo)!.item.data),
    [wayTree]
  );
  const onClick: MapMouseHandler = useCallback(
    ({ geo }) => {
      const way = nearestLine(wayTree, geo)!.item.data;
      navigate({
        to: '/ways/$name',
        params: { name: way.properties.displayName },
      });
    },
    [wayTree]
  );

  return (
    <WayMap>
      <WayHoverInfo>
        {hoveredStreet
          ? hoveredStreet.properties.displayName
          : '(hover over a street)'}
      </WayHoverInfo>
      <MapComponent
        width={1000}
        height={1000}
        onMouseMove={onMouseMove}
        onClick={onClick}
      >
        {hoveredStreet ? (
          <Ways features={[hoveredStreet]} selected={true} />
        ) : null}
      </MapComponent>
    </WayMap>
  );
};

export default function WayList({
  wayTree,
  groupedWays,
}: {
  wayTree: WayTree;
  groupedWays: GroupedWays[];
}) {
  return (
    <StandardPage className="classic-page">
      <PageTitle>Streets</PageTitle>
      <HoverStreetMap wayTree={wayTree} />
      <WayListColumns>
        {groupedWays.map((way) => (
          <li key={way.displayName}>
            <Link to="/ways/$name" params={{ name: way.displayName }}>
              {way.displayName}
            </Link>
          </li>
        ))}
      </WayListColumns>
    </StandardPage>
  );
}
