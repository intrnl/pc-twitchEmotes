'use strict'

const { React } = require('powercord/webpack')
const { Tooltip } = require('powercord/components')


class Emote extends React.Component {
  render () {
    const { emote, jumboable } = this.props

    const classes = ['emoji']
    if (jumboable) classes.push('jumboable')

    return (
      <Tooltip
        text={`;${emote.name};`}
        delay={750}
        hideOnClick={true}
      >
        <img
          className={classes.join(' ')}
          src={emote.src}
          alt={`;${emote.name};`}
          draggable={'false'}
        />
      </Tooltip>
    )
  }
}

module.exports = Emote
