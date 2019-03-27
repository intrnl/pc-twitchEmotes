'use strict'

const Plugin = require('powercord/Plugin')
const { getModule, getModuleByDisplayName } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')

const Emote = require('./emotes/EmoteComponent.jsx')
const EmoteProviders = require('./emotes/provider.json')

const path = require('path')
const fs = require('fs')
const StreamArray = require('./dependencies/StreamArray.js')

class TwitchEmotes extends Plugin {
  async start () {
    if (!this.initializedEmoteStore) await this.initializeEmoteStore()
    
    this.patchMessageContent()
  }
  
  unload () {
    uninject('pc-twitchEmotes-MessageContent')
  }
  
  
  // Emote store
  get emotePath () {
    return path.join(__dirname, 'emotes', 'store.json')
  }
  get emoteStore () {
    return this._db || (this._db = new Map())
  }
  
  async initializeEmoteStore () {
    this.log('Initializing emotes store')
    
    const jsonStream = StreamArray.withParser()

    jsonStream.on('data', ({ value: emote }) => {
      const { id: name, type: set, value } = emote

      this.emoteStore.set(name, {
        name,
        set,
        id: value.id || value,
        src: EmoteProviders[set].replace(':id', value.id || value),
      })
    })

    jsonStream.on('end', () => {
      this.initializedEmoteStore = true
      this.log('Finished initializing emotes store')
    })

    fs.createReadStream(this.emotePath).pipe(jsonStream.input)
  }

  findEmoteByName (name, simple = true) {
    const emote = this.emoteStore.get(name)
    if (!emote) return null

    return emote
  }

  // Patch
  async patchMessageContent () {
    const MessageContent = await getModuleByDisplayName('MessageContent')
    this.log('Patching MessageContent')

    const _this = this
    inject('pc-twitchEmotes-MessageContent', MessageContent.prototype, 'render', function (args, res) {
      const markup = this.props.message.contentParsed
      if (!Array.isArray(markup)) return res
      
      const jumboable = !markup.some((child) => {
        if (typeof child !== 'string') {
          // Markdown
          if (typeof child === 'object' &&
            ['em', 'strong', 'u', 's', 'code', 'pre'].includes(child.type)) return true

          // Mentions
          if (typeof child === 'object' &&
            child.props.children &&
            child.props.children.type && 
            child.props.children.type.displayName &&
            child.props.children.type.displayName === 'Mention') return true

          return false
        }

        return /(?:^| )\w+/g.test(child)
      })
      
      const newMarkup = []
  
      for (const child of markup) {
        if (typeof child !== 'string') {
          if (typeof child === 'object') {
            const emoji = child.props.children
            if (emoji && emoji.props && emoji.props.emojiName) emoji.props.jumboable = jumboable
          }
  
          newMarkup.push(child)
          continue
        }
  
        if (!/;(\w+);/g.test(child)) {
          newMarkup.push(child)
          continue
        }
  
        const words = child.split(/([^\s]+)([\s]|$)/g).filter(f => f !== '');
        let str = ''
  
        for (const word of words) {
          const isEmote = /;(.*?);/g.exec(word)
  
          if (!isEmote) {
            str += word
            continue
          }
  
          const emote = _this.findEmoteByName(isEmote[1])
  
          if (!emote) {
            str += word
            continue
          }
  
          newMarkup.push(str)
          str = ''
  
          const emoteComponent = new Emote({ emote, jumboable })
          newMarkup.push(emoteComponent.render())
        }
        if (str !== '') newMarkup.push(str)
      }
  
      this.props.message.contentParsed = newMarkup
      return res
    })
  }
}

module.exports = TwitchEmotes
