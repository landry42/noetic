import { NgxDropzoneModule } from 'ngx-dropzone';
import { VariablesViewerComponent } from './modals/variables-viewer/variables-viewer.component';
import { TranslateModule } from '@ngx-translate/core';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardBookComponent } from './card-book/card-book.component';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { AvatarComponent } from './avatar/avatar.component';
import { ModalModule } from './modals/modal.module';
import { LogComponent } from './log/log.component';
import { UserChipComponent } from './user-chip/user-chip.component';
import { PipesModule } from '../pipes/pipes.module';
import { UserAvatarComponent } from './user-avatar/user-avatar.component';
import { BookChipComponent } from './book-chip/book-chip.component';
import { TutoPopoverComponent } from './tuto-popover/tuto-popover.component';
import { LogEditComponent } from './log-edit/log-edit.component';
import { EntityModalComponent } from './modals/entity-modal/entity-modal.component';
import { IdFinderComponent } from './modals/id-finder/id-finder.component';
import { CommentComponent } from './comment/comment.component';

@NgModule({
  declarations: [
    CardBookComponent,
    AvatarComponent,
    LogComponent,
    UserChipComponent,
    UserAvatarComponent,
    BookChipComponent,
    TutoPopoverComponent,
    LogEditComponent,
    EntityModalComponent,
    IdFinderComponent,
    VariablesViewerComponent,
    CommentComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ModalModule,
    PipesModule,
    TranslateModule,
    NgxDropzoneModule
  ],
  exports: [
    CardBookComponent,
    AvatarComponent,
    LogComponent,
    UserChipComponent,
    UserAvatarComponent,
    BookChipComponent,
    TutoPopoverComponent,
    LogEditComponent,
    EntityModalComponent,
    IdFinderComponent,
    VariablesViewerComponent,
    CommentComponent
  ]
})

export class ComponentModule {
  static forRoot(): ModuleWithProviders<ComponentModule> {
    return {
      ngModule: ComponentModule,
    };
  }
}
