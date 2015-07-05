import * as React from 'react';


export default React.createClass({
  getInitialState() {
    return {chapter: -1};
  },

  advance(n=1, play) {
    const {video} = this.props;
    let {chapter} = this.state;
    chapter = (chapter + 1) % video.chapters.length;
    this.videoNode.src = video.chapters[chapter].low;
    this.videoNode.poster = video.chapters[chapter].stills[0].large;
    if (play) {
      this.videoNode.play();
    }
    this.setState({chapter});
  },

  previous(e) {
    e.preventDefault();
    this.advance(-1);
  },

  next(e) {
    e.preventDefault();
    this.advance(1);
  },

  render() {
    const {video} = this.props;
    return (
      <div>
        <video controls="true" width="640" height="360" poster={video.stills[0].large} ref={component => this.videoNode = React.findDOMNode(component)}/>
        <p><a onClick={this.previous}>previous</a> <a onClick={this.next}>next</a></p>
      </div>
    );
  },

  onEnded() {
    this.advance(1, true);
  },

  componentDidMount() {
    this.videoNode.addEventListener('ended', this.onEnded);
    this.advance();
  }
});
