import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHistory } from 'react-router';
import styled from 'styled-components';

import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import Ways from '../Ways';
import WayListColumns from '../WayListColumns';
import { GroupedWays, WayFeature, WayTree } from '../../ways';
import StandardPage from '../StandardPage';
import { nearestLineSegmentUsingRtree } from '../../geo';

const WayMap = styled.div`
  position: relative;
  display: inline-block;
`;

const WayHoverInfo = styled.div`
  position: absolute;
  // just kinda inside somerville
  top: 350px;
  left: 400px;

  padding: 0.4em;
  background: #eee;
  box-shadow: 3px 3px 0 0 #dfdfdf;
  font-weight: bold;
`;

const HoverStreetMap = function WayList({ wayTree }: { wayTree: WayTree }) {
  const history = useHistory();
  const [hoveredStreet, setHoveredStreet] = useState<WayFeature>();
  const onMouseMove = useCallback(
    ({ geo }) =>
      setHoveredStreet(nearestLineSegmentUsingRtree(wayTree, geo)!.item.data),
    [wayTree]
  );
  const onClick = useCallback(
    ({ geo }) => {
      const way = nearestLineSegmentUsingRtree(wayTree, geo)!.item.data;
      history.push(`/ways/${way.properties.displayName}`);
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
    <StandardPage>
      <PageTitle>Streets</PageTitle>
      <HoverStreetMap wayTree={wayTree} />
      <WayListColumns>
        {groupedWays.map((way) => (
          <li key={way.displayName}>
            <Link to={`/ways/${way.displayName}`}>{way.displayName}</Link>
          </li>
        ))}
      </WayListColumns>
    </StandardPage>
  );
}
