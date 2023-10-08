import { useContext } from 'react';
import DataSetContext from '../components/DataSetContext';
import VideoPlayer from '../components/VideoPlayer';

export default function VideoExample({ name }: { name: string }) {
  const dataSet = useContext(DataSetContext);
  const video = dataSet.videos.get(name);
  if (!video) {
    return <div>Video not found</div>;
  }
  return (
    <VideoPlayer
      video={video}
      seek={0}
      onLocationChange={() => {}}
      showChapterSelect
    />
  );
}
