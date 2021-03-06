import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import * as _ from 'lodash';

import { UPDATE, CursorPosition, EditorState } from '../shared/index';
import { TemplateService } from '../../shared/index';

declare const __moduleName: string;
declare const monaco: any;
declare const require: any;

@Component({
  moduleId: __moduleName,
  selector: 'monaco',
  templateUrl: 'monaco.component.html',
  styleUrls: ['monaco.component.css']
})
export class MonacoComponent {
  @ViewChild('editor') editorElementRef: ElementRef;

  private editorLoaded = false;
  private templateSub: any;
  private navigationSub: any;
  private editor: any;

  constructor(
    private route: ActivatedRoute,
    private store: Store<EditorState>,
    private templateService: TemplateService) { }

  ngOnInit() {
    let onAmdLoaderLoad = () => {
      (<any>window).require(['vs/editor/editor.main'], () => {
        this.initMonaco();

        this.navigationSub = this.route.params
          .subscribe(params => this.setPosition(+params['resourceId']));

        this.templateSub = this.templateService.templateChanged
          .subscribe(() => this.setContent());

      });
    };

    if (!(<any>window).require) {
      let loaderScript = document.createElement('script');
      loaderScript.src = 'vs/loader.js';
      loaderScript.onload = onAmdLoaderLoad;
      document.getElementsByTagName('head')[0].appendChild(loaderScript);
    } else {
      onAmdLoaderLoad();
    }
  }

  ngOnDestroy() {
    this.templateSub.unsubscribe();
    this.navigationSub.unsubscribe();

    this.destroyMonaco();
  }

  private initMonaco() {
    let editorDiv: HTMLDivElement = this.editorElementRef.nativeElement;
    this.editor = monaco.editor.create(editorDiv, {
      value: this.templateService.templateData,
      language: 'json'
    });

    this.editorLoaded = true;

    window.onresize = () => {
      let windowWidth = window.innerWidth;
      let sidebarWidth = document.getElementById('sidebar-container').clientWidth;
      let editorWidth = (windowWidth - sidebarWidth).toString() + 'px';
      (<HTMLDivElement>this.editorElementRef.nativeElement).style.width = editorWidth;
      this.editor.layout();
    };
  }

  private destroyMonaco() {
    if (this.editor) {
      this.templateService.loadTemplate(this.editor.getValue());
      this.savePosition();
      this.editor.destroy();
    }
  }

  private setContent() {
    this.editor.setValue(this.templateService.templateData);
  }

  private setPosition(resourceId?: number) {
    if (typeof resourceId === 'number' && !isNaN(resourceId)) {
      this.revealResourcePosition(resourceId);
    } else {
      this.restorePosition();
    }

    this.editor.focus();
  }

  private revealResourcePosition(resourceId: number) {
    let resource = this.templateService.getAllResources()[resourceId];
    let resourceString = JSON.stringify(resource, null, 2);

    let target = resourceString.split('\n').map(line => line.trim()).join('\n');
    let source = this.editor.getValue().split('\n').map(line => line.trim()).join('\n');

    let pos = source.indexOf(target);
    let lineNumber = source.substr(0, pos).split('\n').length + 1;

    this.editor.revealLineInCenter(lineNumber + 10);
    this.editor.setPosition({ lineNumber: lineNumber, column: 0 });
  }

  private savePosition() {
    this.store.dispatch({ type: UPDATE, payload: this.editor.getPosition() });
  }

  private restorePosition() {
    this.store.select('cursorPosition')
      .subscribe(position => {
        let revealPosition = {
          lineNumber: position.lineNumber + 10,
          column: position.column
        };

        this.editor.revealPositionInCenter(revealPosition);
        this.editor.setPosition(position);
      });
  }
}
