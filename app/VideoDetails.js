import * as React from 'react';


export default React.createClass({
  render() {
    const {video} = this.props;
    return (
      <div>
        <h1>{video.name}</h1>
        <pre>{JSON.stringify(video, null, 2)}</pre>
        <div><video src={`http://static.ryanberdeen.com/everywhere/video/mp4-low/${video.name}.MP4`} controls="true" width="640" height="360"/></div>
        <div>{Array(...Array(Math.ceil(video.duration / 30))).map((_, i) => (
          <a href={`http://static.ryanberdeen.com/everywhere/video/thumbnails/${video.name}/large-${i}.jpg`} key={i}><img src={`http://static.ryanberdeen.com/everywhere/video/thumbnails/${video.name}/small-${i}.jpg`} width="320"/></a>
        ))}</div>
      </div>
    );
  }
});
