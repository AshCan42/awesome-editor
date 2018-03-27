import React, { Component } from 'react';
import './AutoCompletePanel.css';

export class AutoCompletePanel extends Component {
    render() {
        return (
            <div className='panel' style={{left: this.props.match.left + 'px', top: this.props.match.top + 'px'}}>
                <ul>
                    {this.props.match.data.map((item, index) => {
                        return (<li className={index===this.props.match.selection ? 'selected' : ''} >{item}</li>);
                    })}
                </ul>
            </div>
        );
    }
}