import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Overlay } from 'react-bootstrap';
import {CompositeDecorator, Editor, EditorState, Entity, Modifier, getDefaultKeyBinding} from 'draft-js';
import {AutoCompletePanel} from './AutoCompletePanel';
import * as data from './data.js';
import './AwesomeEditor.css';
import './Draft.css';


export class AwesomeEditor extends Component {
  constructor(props) {
    super(props);
    const compositeDecorator = new CompositeDecorator([
      {
        strategy: this.fillingStrategy,
        component: this.FillingSpan,
      },
      {
        strategy: this.submittedStrategy,
        component: this.SubmittedSpan,
      }
    ]);
    this.state = {
      editorState: EditorState.createEmpty(compositeDecorator),
      matchState: null
    };
    this.handleKeyCommand = this.handleKeyCommand.bind(this);
    this.onChange = (editorState) => {
      const selection = editorState.getSelection();
      const content = editorState.getCurrentContent();
      const key = selection.getStartKey();
      const offset = selection.getStartOffset();
      const block = content.getBlockForKey(key);
      const matchState = this.matchStateAtOffset(block, offset);
      if(matchState) editorState = this.applyFillingEntity(editorState, matchState, block, offset);
      this.setState({editorState, matchState});
    }
  }

  render() {
    return (
      <div className="container">
        <div className="editor">
          <Editor
            editorState={this.state.editorState}
            matchState={this.state.matchState}
            handleKeyCommand={this.handleKeyCommand}
            keyBindingFn={this.keyBindingFn}
            onChange={this.onChange}
            onUpArrow = {this.onUpArrow}
            onDownArrow = {this.onDownArrow}
            onTab = {this.onTab}
          />
        </div>
        {this.renderAutoCompletePanel()}
      </div>
    );
  }

  renderAutoCompletePanel() {
    if(!this.state.matchState) return null;
    return <AutoCompletePanel match={this.state.matchState}/>
  }

  keyBindingFn(e) {
    if(this.matchState != null) {
      if(e.keyCode === 13) {
        return 'autocomplete';
      }
      else if(e.keyCode === 32 && this.matchState.trigger==='#') {
        return 'autocomplete'
      }
    }
    return getDefaultKeyBinding(e);
  }

  onUpArrow(e) {
    if(this.matchState != null) {
      e.preventDefault();
      this.handleKeyCommand('selectUp');
    }
  }

  onDownArrow(e) {
    if(this.matchState != null) {
      e.preventDefault();
      this.handleKeyCommand('selectDown');
    }
  }

  onTab(e) {
    if(this.matchState != null) {
      e.preventDefault();
      this.handleKeyCommand('autocomplete');
    }
  }

  handleKeyCommand(command) {
    if(command === 'selectUp') {
      const newMatchState = this.state.matchState;
      if(newMatchState.selection <= 0) {
        newMatchState.selection = newMatchState.data.length - 1;
      }
      else {
        newMatchState.selection--;
      }
      this.setState({matchState: newMatchState});
      return 'handled';
    }
    else if(command === 'selectDown') {
      const newMatchState = this.state.matchState;
      if(newMatchState.selection >= newMatchState.data.length - 1) {
        newMatchState.selection = 0;
      }
      else {
        newMatchState.selection++;
      }
      this.setState({matchState: newMatchState});
      return 'handled';
    }
    else if(command === 'autocomplete') {
      this.autocomplete();
      return 'handled';
    }
    return 'not-handled';
  }

  matchStateAtOffset(block, offset) {
    const entityKey = block.getEntityAt(offset-1)
    if(entityKey) {
      const entity = Entity.get(entityKey);
      if(entity.data.submitted) return null;
    }

    const HASHTAG_REGEX = /#[\w]*/g;
    const PERSON_REGEX = /@[\w]*[ ]?[\w]*/g;
    const RELATION_REGEX = /<>[\w]*([ ]?[\w]*)*/g;
    
    let matchState;
    if((matchState = this.findWithRegex(HASHTAG_REGEX, '#', data.tags, block, offset)) != null) {
      return matchState;
    }
    else if((matchState = this.findWithRegex(PERSON_REGEX, '@', data.persons, block, offset)) != null) {
      return matchState;
    }
    else if((matchState = this.findWithRegex(RELATION_REGEX, '<>', data.ideas, block, offset)) != null) {
      return matchState;
    }
    return null;
  }

  findWithRegex(regex, trigger, data, block, offset) {
    let match;
    while ((match = regex.exec(block.text)) !== null) {
      if(match.index + trigger.length <= offset && (match.index + trigger.length + match[0].length) > offset) {
        const entityKey = block.getEntityAt(match.index)
        if(entityKey) {
          const entity = Entity.get(entityKey);
          if(entity.data.submitted) return null;
        }

        const str = match[0].substring(trigger.length, offset - match.index);
        const matchArr = data.filter((item) => item.toLowerCase().startsWith(str.toLowerCase())).sort();
        return {
          str: str, 
          start: match.index, 
          trigger: trigger,
          data: matchArr,
          selection: 0,
          blockKey: block.getKey()
        };
      }
    }
  }

  applyFillingEntity(editorState, matchState, block, offset) {
    // Do nothing for submitted entity, create new entity if none exists
    let entityKey = block.getEntityAt(offset-1);
    if(entityKey) {
      const entity = Entity.get(entityKey);
      if(entity.data.submitted) return null;
    }
    else {
      entityKey = Entity.create('MENTION','MUTABLE',{submitted: false});
    }

    // Select full word including trigger
    let wordSelection = editorState.getSelection().merge({
      anchorOffset: matchState.start,
      focusOffset: matchState.start + matchState.trigger.length + matchState.str.length
    });

    // Apply entity to full word
    const contentState = editorState.getCurrentContent();
    let newContent = Modifier.applyEntity(
      contentState,
      wordSelection,
      entityKey
    );
    editorState = EditorState.push(editorState, newContent, 'change-block-data');

    // Capture selection coordinates
    if(window.getSelection().rangeCount) {
      const range = window.getSelection().getRangeAt(0).cloneRange();
      const index = range.startContainer.textContent.lastIndexOf(matchState.trigger);
      if(index < 0) {
        // Hardcoded workaround for first editor entry edge case
        matchState.left = 20;
      }
      else {
        range.setStart(range.startContainer, index >= 0 ? index : 0);
        const rangeRect = range.getBoundingClientRect();
        let [left, top] = [rangeRect.left, rangeRect.bottom];
        matchState.left = left; matchState.top = top;
      }
    }

    // Reset selection
    wordSelection = wordSelection.merge({
      anchorOffset: wordSelection.focusOffset,
    });
    editorState = EditorState.forceSelection(editorState, wordSelection);

    return editorState;
  }

  autocomplete() {
    const editorState = this.state.editorState;
    const matchState = this.state.matchState;
    const word = matchState.trigger + (matchState.data.length ? matchState.data[matchState.selection] : matchState.str);

    // Create new entity
    const entityKey = Entity.create('MENTION','IMMUTABLE',{submitted: true});
    const wordSelection = editorState.getSelection().merge({
      anchorOffset: matchState.start,
      focusOffset: matchState.start + matchState.trigger.length + matchState.str.length
    });

    // Replace partial word with full word, apply entity, insert space after
    const contentState = editorState.getCurrentContent();
    let newContent = Modifier.replaceText(contentState, wordSelection, word, [], entityKey);
    newContent = Modifier.insertText(newContent, newContent.getSelectionAfter(), ' ');

    const newEditorState = EditorState.push(editorState, newContent, 'insert-mention');
    this.setState({editorState: newEditorState, matchState: null});
  }

  fillingStrategy(contentBlock, callback, contentState) {
    contentBlock.findEntityRanges(
      (value) => value.getEntity() && !Entity.get(value.getEntity()).data.submitted, 
      (start, end) => callback(start, end)
    );
  }

  submittedStrategy(contentBlock, callback, contentState) {
    contentBlock.findEntityRanges(
      (value) => value.getEntity() && Entity.get(value.getEntity()).data.submitted, 
      (start, end) => callback(start, end)
    );
  }

  FillingSpan = (props) => {
    return <span className="filling">{props.children}</span>;
  };

  SubmittedSpan = (props) => {
    return <span className="submitted">{props.children}</span>;
  };
}